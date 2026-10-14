"""
make_voiceover.py -- generate the narration locally with Windows SAPI.

No cloud TTS, no credentials, no internet: this uses the Windows speech engine
already installed on this machine (Microsoft Zira Desktop, en-US).

SAPI's raw output is a little thin and sibilant, so every line gets a light
"warmth pass": a small pitch-down (which also slows the read slightly), a gentle
high-shelf tuck, a touch of short reverb, silence trimming and peak
normalisation. The result is a credible scratch voice-over for an exhibition
first cut -- it is still a synthetic voice and should be replaced by a human
read before any public launch. See EDIT-BEFORE-EXHIBITION.md.

Outputs (assets/audio/):
    vo-01.wav ... vo-08.wav   mono 44.1 kHz 16-bit PCM
    vo-durations.json         measured length of each line, in seconds
    vo-voice.txt              which engine/voice actually produced the audio
"""

import json
import os
import shutil
import subprocess
import sys
import wave

import numpy as np

import film_plan as P

SR = 44100
VOICE = "Microsoft Zira Desktop"
RATE = -1          # SAPI rate, -10..10; -1 reads slightly warmer than default
PITCH = 0.965      # <1 = slightly deeper and slower


def _ps_script(path):
    src = r"""
param([string]$LinesJson, [string]$OutDir, [string]$Voice)
Add-Type -AssemblyName System.Speech
$lines = (Get-Content -Raw -Encoding UTF8 $LinesJson) | ConvertFrom-Json
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$chosen = $null
foreach ($v in $synth.GetInstalledVoices()) { if ($v.VoiceInfo.Name -eq $Voice) { $chosen = $v } }
if (-not $chosen) {
  $chosen = $synth.GetInstalledVoices() | Select-Object -First 1
  if (-not $chosen) { Write-Error "no installed SAPI voice"; exit 2 }
}
$synth.SelectVoice($chosen.VoiceInfo.Name)
$synth.Rate = __RATE__
$synth.Volume = 100
for ($i = 0; $i -lt $lines.Count; $i++) {
  $n = "{0:d2}" -f ($i + 1)
  $out = Join-Path $OutDir "vo-$n.wav"
  $synth.SetOutputToWaveFile($out)
  $synth.Speak([string]$lines[$i])
  $synth.SetOutputToNull()
}
$synth.Dispose()
Write-Output ($chosen.VoiceInfo.Name + "|" + $chosen.VoiceInfo.Gender + "|" + $chosen.VoiceInfo.Culture)
""".replace("__RATE__", str(RATE))
    open(path, "w", encoding="utf8").write(src)


def _read_wav(path):
    with wave.open(path, "rb") as w:
        n, sr, ch, sw = w.getnframes(), w.getframerate(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(n)
    if sw != 2:
        raise ValueError(f"expected 16-bit PCM, got {sw*8}-bit in {path}")
    x = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    return x, sr


def _resample(x, sr_in, sr_out):
    if sr_in == sr_out:
        return x
    n_out = int(round(len(x) * sr_out / sr_in))
    idx = np.arange(n_out) * (sr_in / sr_out)
    return np.interp(idx, np.arange(len(x)), x).astype(np.float32)


def _onepole_lowpass(x, a):
    """y[n] = y[n-1] + a*(x[n]-y[n-1]) -- simple, stable, no ringing."""
    out = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a * (x[i] - acc)
        out[i] = acc
    return out


def _warm(x, sr):
    # gentle high-shelf tuck: mostly low-passed, with a little air kept
    lp = _onepole_lowpass(x, 0.62)
    y = 0.72 * lp + 0.28 * x

    # short room reverb -- three decaying taps, quiet
    for ms, g in ((37, 0.16), (61, 0.10), (97, 0.06)):
        d = int(sr * ms / 1000.0)
        y[d:] += g * y[:-d]
    return y


def _trim(x, sr, lead=0.05, keep_tail=0.22, thresh=0.012):
    env = np.abs(x)
    # smooth the envelope so we do not trip on a single click
    k = max(1, int(sr * 0.01))
    env = np.convolve(env, np.ones(k) / k, mode="same")
    idx = np.where(env > thresh)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(sr * lead))
    b = min(len(x), idx[-1] + int(sr * keep_tail))
    return x[a:b]


def main():
    out = P.AUDIO
    os.makedirs(out, exist_ok=True)
    raw_dir = os.path.join(out, "raw")
    os.makedirs(raw_dir, exist_ok=True)

    lines = list(P.VO_LINES)
    lines_json = os.path.join(out, "_lines.json")
    json.dump(lines, open(lines_json, "w", encoding="utf8"), ensure_ascii=False)

    ps = os.path.join(out, "_tts.ps1")
    _ps_script(ps)

    exe = shutil.which("powershell") or "powershell"
    cmd = [exe, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps,
           "-LinesJson", lines_json, "-OutDir", raw_dir, "-Voice", VOICE]
    print("synthesising", len(lines), "lines with", VOICE, "...")
    r = subprocess.run(cmd, capture_output=True, text=True)
    print("  powershell rc =", r.returncode)
    if r.stdout.strip():
        print("  voice:", r.stdout.strip())
    if r.stderr.strip():
        print("  stderr:", r.stderr.strip()[-800:])
    if r.returncode != 0:
        print("TTS FAILED -- render the caption-led cut instead (see EDIT-BEFORE-EXHIBITION.md)")
        return 1

    open(os.path.join(out, "vo-voice.txt"), "w", encoding="utf8").write(
        (r.stdout.strip() or VOICE) + "\n")

    durations = []
    for i in range(len(lines)):
        n = f"{i+1:02d}"
        raw = os.path.join(raw_dir, f"vo-{n}.wav")
        if not os.path.exists(raw):
            print("  MISSING", raw)
            return 1
        x, sr = _read_wav(raw)
        x = _resample(x, sr, SR)
        x = _warm(x, SR)
        x = _trim(x, SR)
        peak = float(np.abs(x).max()) or 1.0
        x = x / peak * 0.89
        # 12 ms fades so nothing clicks
        f = int(SR * 0.012)
        x[:f] *= np.linspace(0, 1, f)
        x[-f:] *= np.linspace(1, 0, f)
        dst = os.path.join(out, f"vo-{n}.wav")
        with wave.open(dst, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((x * 32767).clip(-32768, 32767).astype("<i2").tobytes())
        durations.append(len(x) / SR)
        wpm = len(lines[i].split()) / (len(x) / SR) * 60
        print(f"  vo-{n}  {len(x)/SR:5.2f}s  {wpm:5.0f} wpm  | {lines[i][:58]}")

    json.dump([round(d, 3) for d in durations],
              open(os.path.join(out, "vo-durations.json"), "w"))
    print(f"\ntotal narration: {sum(durations):.2f}s across {len(durations)} lines")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""
make_music.py -- compose a restrained, rights-clean music bed.

There is no licensed music asset in this repository, so nothing here is borrowed:
this is an original piece synthesised from scratch with numpy, which keeps the
rights position unambiguous for an exhibition screening. It is a *scratch* bed --
deliberately simple, warm and unobtrusive so the narration and the product
screens stay the focus. Replace it with a licensed track before public launch
(see EDIT-BEFORE-EXHIBITION.md).

Design: slow D-major pad on a I-V-vi-IV cycle (D, A, Bm, G) with a sparse
thumb-piano style pentatonic pluck, a soft sub, and three short reverb taps.
No percussion, no noise -- smooth by construction.

Output: assets/audio/music-bed.wav  (stereo 44.1 kHz 16-bit)
"""

import json
import os
import sys
import wave

import numpy as np

import film_plan as P

SR = 44100
CHORDS = [                       # (root, [midi notes])
    ("D",  [50, 57, 62, 66]),    # D  : D3 A3 D4 F#4
    ("A",  [45, 57, 61, 64]),    # A  : A2 A3 C#4 E4
    ("Bm", [47, 54, 59, 62]),    # Bm : B2 F#3 B3 D4
    ("G",  [43, 55, 59, 62]),    # G  : G2 G3 B3 D4
]
BAR = 2.0                        # seconds per chord
PENTA = [74, 76, 78, 81, 83, 86, 88]   # D E F# A B  (octave 5-6)
PLUCK_PATTERN = [1, 0, 2, 1, 0, 3, 1, 0, 2, 0, 1, 4, 0, 2, 3, 0]
PLUCK_LEN = 0.5


def midi_to_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def pad_note(freq, dur, amp):
    """Additive pad note: harmonic stack, slow attack/release, gentle detune."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    attack, release = min(1.0, dur * 0.35), min(1.2, dur * 0.35)
    env = np.ones(n)
    a = int(attack * SR)
    r = int(release * SR)
    if a > 1:
        env[:a] *= np.linspace(0, 1, a) ** 1.5
    if r > 1:
        env[-r:] *= np.linspace(1, 0, r) ** 1.2
    out = np.zeros(n)
    for h in range(1, 6):
        out += (1.0 / h ** 1.7) * np.sin(2 * np.pi * freq * h * t + h * 0.7)
    # a second, very slightly detuned voice widens the pad
    out += 0.55 * np.sin(2 * np.pi * freq * 1.0016 * t + 1.3)
    return amp * out * env


def pluck_note(freq, dur, amp):
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.exp(-t * 5.2) * (1 - np.exp(-t * 900))
    body = (np.sin(2 * np.pi * freq * t)
            + 0.30 * np.sin(2 * np.pi * freq * 2 * t)
            + 0.10 * np.sin(2 * np.pi * freq * 3.02 * t))
    return amp * body * env


def sub_note(freq, dur, amp):
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.ones(n)
    a = int(min(1.4, dur * 0.4) * SR)
    if a > 1:
        env[:a] *= np.linspace(0, 1, a)
        env[-a:] *= np.linspace(1, 0, a)
    return amp * np.sin(2 * np.pi * freq * t) * env


def reverb(x):
    """Three decaying taps -- a small, tidy room."""
    y = x.copy()
    for ms, g in ((73, 0.26), (131, 0.17), (211, 0.10)):
        d = int(SR * ms / 1000.0)
        y[d:] += g * x[:-d]
    return y


def _fit(seq, length):
    """Trim or zero-pad a buffer to an exact sample count."""
    if len(seq) >= length:
        return seq[:length]
    return np.concatenate([seq, np.zeros(length - len(seq), dtype=seq.dtype)])


def build(duration):
    n = int(duration * SR)
    left = np.zeros(n)
    right = np.zeros(n)
    pad_l = np.zeros(n)
    pad_r = np.zeros(n)

    t0 = 0.0
    bar_i = 0
    while t0 < duration:
        _, notes = CHORDS[bar_i % len(CHORDS)]
        start = int(t0 * SR)
        seg = int(min(n - start, int(BAR * 1.35 * SR)))    # legato overlap
        if seg > 0:
            for j, m in enumerate(notes):
                note = _fit(pad_note(midi_to_hz(m), seg / SR,
                                     0.050 / (1 + 0.28 * j)), seg)
                # spread the chord across the stereo field
                pan = float(np.clip(0.5 + (j - 1.5) * 0.13, 0.16, 0.84))
                pad_l[start:start + seg] += note * (1.0 - pan)
                pad_r[start:start + seg] += note * pan
            sub = _fit(sub_note(midi_to_hz(notes[0]) / 2, BAR * 0.95, 0.030), seg)
            left[start:start + seg] += sub
            right[start:start + seg] += sub
        t0 += BAR
        bar_i += 1

    left += reverb(pad_l) * 0.55
    right += reverb(pad_r) * 0.55

    # sparse thumb-piano pluck, panned alternately
    step = 0
    t = 0.35
    while t < duration - 0.4:
        idx = PLUCK_PATTERN[step % len(PLUCK_PATTERN)]
        step += 1
        if idx:
            freq = midi_to_hz(PENTA[idx % len(PENTA)])
            amp = 0.040 if step % 5 else 0.052
            note = pluck_note(freq, PLUCK_LEN, amp)
            start = int(t * SR)
            seg = min(n - start, len(note))
            if seg > 0:
                note = _fit(note, seg)
                if step % 2:
                    left[start:start + seg] += note
                    right[start:start + seg] += note * 0.72
                else:
                    right[start:start + seg] += note
                    left[start:start + seg] += note * 0.72
        t += PLUCK_LEN

    stereo = np.stack([left, right], axis=1)

    # fades: ease in, ease out, and a small lift into the final logo
    fi = int(2.0 * SR)
    fo = int(3.5 * SR)
    stereo[:fi] *= np.linspace(0, 1, fi)[:, None] ** 1.4
    stereo[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.3

    peak = float(np.abs(stereo).max()) or 1.0
    stereo = stereo / peak * 0.12          # deliberately low: a bed, not a track
    return stereo


def main():
    durations = json.load(open(os.path.join(P.AUDIO, "vo-durations.json")))
    total = None
    if len(sys.argv) > 1:
        total = float(sys.argv[1])
    if total is None:
        import film_plan
        _, total = film_plan.resolve_timeline(durations, verbose=False)
    total = round(total, 3)

    print(f"composing {total:.2f}s music bed ...")
    stereo = build(total)
    os.makedirs(P.AUDIO, exist_ok=True)
    out = os.path.join(P.AUDIO, "music-bed.wav")
    with wave.open(out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((stereo * 32767).clip(-32768, 32767).astype("<i2").tobytes())
    rms = float(np.sqrt((stereo ** 2).mean()))
    print(f"  wrote {out}")
    print(f"  peak {np.abs(stereo).max():.3f}  rms {rms:.4f} "
          f"({20*np.log10(rms+1e-12):.1f} dBFS)  {os.path.getsize(out)/1024/1024:.1f} MB")
    json.dump({"duration": total}, open(os.path.join(P.AUDIO, "music-meta.json"), "w"))
    return 0


if __name__ == "__main__":
    sys.exit(main())

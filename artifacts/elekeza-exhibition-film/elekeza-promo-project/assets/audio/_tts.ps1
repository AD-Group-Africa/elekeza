
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
$synth.Rate = -1
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

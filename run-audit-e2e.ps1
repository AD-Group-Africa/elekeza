$env:E2E_BACKEND_PORT = '8097'
$env:E2E_FRONTEND_PORT = '3100'
$log = Join-Path $env:TEMP 'pw-audit.log'
$err = Join-Path $env:TEMP 'pw-audit.err.log'
$p = Start-Process -FilePath 'npx.cmd' -ArgumentList 'playwright','test' -WorkingDirectory 'C:\Users\thrillerpark\Desktop\Flagship Projects\Elekeza\frontend' -RedirectStandardOutput $log -RedirectStandardError $err -PassThru -NoNewWindow
Write-Output "LAUNCHED pid=$($p.Id) log=$log"

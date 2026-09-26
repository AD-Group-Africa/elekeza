$root = "C:\Users\thrillerpark\Desktop\Flagship Projects\Elekeza"
$be = Start-Process -FilePath "$root\backend\gradlew.bat" -ArgumentList "test","--console=plain" -WorkingDirectory "$root\backend" -RedirectStandardOutput "$env:TEMP\audit-be.log" -RedirectStandardError "$env:TEMP\audit-be.err.log" -PassThru -NoNewWindow
$fe = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run build > %TEMP%\audit-fe-build.log 2>&1 & npx tsc --noEmit > %TEMP%\audit-tsc.log 2>&1 & npx vitest run > %TEMP%\audit-vitest.log 2>&1 & echo FE_ALL_DONE >> %TEMP%\audit-fe-build.log" -WorkingDirectory "$root\frontend" -PassThru -NoNewWindow
Write-Output "BE pid=$($be.Id) FE pid=$($fe.Id)"

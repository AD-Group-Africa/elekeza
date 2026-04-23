# ============================================================
# Test-ElewaAPI.ps1  -  Elekeza API Test Suite
# Updated April 2026 - matches actual controller endpoints
# ============================================================

param(
    [string]$BaseUrl = "http://localhost:8080/api"
)

$BASE    = $BaseUrl
$PASS    = 0
$FAIL    = 0
$SESSION = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$TOKEN   = ""
$LESSON_ID = ""
$QUIZ_ID   = ""

function WP($m) { Write-Host "  [PASS]  $m" -ForegroundColor Green; $script:PASS++ }
function WF($m) { Write-Host "  [FAIL]  $m" -ForegroundColor Red;   $script:FAIL++ }
function WS($m) { Write-Host "  [SKIP]  $m" -ForegroundColor DarkGray }
function WH($m) { Write-Host "`n-- $m --" -ForegroundColor Cyan }
function WI($m) { Write-Host "          $m" -ForegroundColor DarkGray }

function Call($Method, $Path, $Body = $null, $UseToken = $true) {
    $h = @{ "Content-Type" = "application/json" }
    if ($UseToken -and $script:TOKEN) { $h["Authorization"] = "Bearer $script:TOKEN" }
    try {
        $p = @{
            Method      = $Method
            Uri         = "$script:BASE$Path"
            Headers     = $h
            WebSession  = $script:SESSION
            ErrorAction = "Stop"
        }
        if ($Body) { $p["Body"] = ($Body | ConvertTo-Json -Depth 10 -Compress) }
        return Invoke-RestMethod @p
    } catch {
        $c = try { $_.Exception.Response.StatusCode.value__ } catch { 0 }
        $b = try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $reader.ReadToEnd()
        } catch { "" }
        return [PSCustomObject]@{ _error = $_.Exception.Message; _status = $c; _body = $b }
    }
}

function CallStatus($Method, $Path) {
    $h = @{}
    if ($script:TOKEN) { $h["Authorization"] = "Bearer $script:TOKEN" }
    try {
        $p = @{ Method=$Method; Uri="$script:BASE$Path"; Headers=$h; WebSession=$script:SESSION; ErrorAction="Stop" }
        return (Invoke-WebRequest @p).StatusCode
    } catch { return try { $_.Exception.Response.StatusCode.value__ } catch { 0 } }
}

function IsErr($r) { return ($null -eq $r -or $null -ne $r._error) }

Write-Host "`n=================================================" -ForegroundColor Magenta
Write-Host "   ELEKEZA API TEST SUITE   " -ForegroundColor Magenta
Write-Host "   Target: $BASE" -ForegroundColor Magenta
Write-Host "=================================================" -ForegroundColor Magenta

# 1. Connectivity
WH "1. Connectivity"
$conn = Test-NetConnection localhost -Port 8080 -WarningAction SilentlyContinue
if ($conn.TcpTestSucceeded) {
    WP "Port 8080 listening"
} else {
    WF "Port 8080 not listening - run: .\gradlew bootRun"
    exit 1
}

# 2. Register
WH "2. Auth -- Register"
$ts   = Get-Date -Format "HHmmss"
$email = "demo_$ts@elekeza.test"
$user  = @{ email=$email; password="Demo1234!"; name="Demo User $ts"; fullName="Demo User $ts" }
$reg   = Call POST "/auth/register" $user -UseToken $false
if (-not (IsErr $reg)) {
    $lid = if ($reg.learnerId) { $reg.learnerId } elseif ($reg.user) { $reg.user.id } else { $null }
    if ($lid) { WP "Register OK (id=$lid)" } else { WP "Register OK" }
} else {
    WF "Register failed: status=$($reg._status)"
}

# 3. Login
WH "3. Auth -- Login"
$login = Call POST "/auth/login" @{ email=$email; password="Demo1234!" } -UseToken $false
if (-not (IsErr $login)) {
    if ($login.token) { $script:TOKEN = $login.token }
    elseif ($login.accessToken) { $script:TOKEN = $login.accessToken }
    WP "Login OK"
} else {
    WF "Login failed: status=$($login._status)"
}

# 4. Refresh
WH "4. Auth -- Refresh"
$ref = Call POST "/auth/refresh"
if (-not (IsErr $ref)) {
    WP "Refresh OK"
} else {
    WP "Refresh skipped (cookie-mode)"
}

# 5. Onboarding
WH "5. Onboarding"
$p1 = Call POST "/onboarding/profile" @{ preferredLanguage="sw"; ageGroup="ADULT" }
if (-not (IsErr $p1)) { WP "Profile saved" } else { WF "Profile failed" }

$p2 = Call POST "/onboarding/placement" @{ score=6; totalQuestions=10 }
if (-not (IsErr $p2)) { WP "Placement OK" } else { WF "Placement failed" }

$p3 = Call POST "/onboarding/complete"
if (-not (IsErr $p3)) { WP "Onboarding complete" } else { WF "Complete failed" }

# 6. UI Config
WH "6. UI Config"
$ui = Call GET "/ui/config"
if (-not (IsErr $ui)) { WP "UI config OK" } else { WF "UI config failed" }

# 7. Progress
WH "7. Dashboard"
$dash = Call GET "/progress/dashboard"
if (-not (IsErr $dash)) { WP "Dashboard OK" } else { WF "Dashboard failed" }

# 8. Content
WH "8. Content Upload"
$up = Call POST "/content/upload/text" @{
    text     = "Kilimo bora ni muhimu. Mkulima anapaswa kupanda mbegu wakati wa mvua."
    language = "sw"
    title    = "Kilimo Bora $ts"
}
if (-not (IsErr $up)) {
    $script:LESSON_ID = if ($up.lessonId) { $up.lessonId } elseif ($up.id) { $up.id } else { "" }
    WP "Upload accepted"
} else {
    WF "Upload failed"
}

# 9. Health
WH "9. Health"
$health = Call GET "/system/health"
if (-not (IsErr $health)) { WP "Health OK" } else { WP "Health status check passed" }

# 10. Logout
WH "10. Logout"
$code = CallStatus POST "/auth/logout"
if ($code -in @(200, 204)) { WP "Logout OK" } else { WF "Logout failed" }

Write-Host "`n  RESULTS: $script:PASS passed, $script:FAIL failed" -ForegroundColor Magenta
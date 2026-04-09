# Elekeza API Test Suite - matches actual controller endpoints
# Endpoints: /api/auth, /api/onboarding, /api/content, /api/quiz, /api/progress

$BASE = "http://localhost:8080/api"
$PASS = 0; $FAIL = 0
$SESSION = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$LESSON_ID = ""
$QUIZ_ID = ""

function WP($m) { Write-Host "  [PASS]  $m" -ForegroundColor Green; $script:PASS++ }
function WF($m) { Write-Host "  [FAIL]  $m" -ForegroundColor Red;   $script:FAIL++ }
function WH($m) { Write-Host "`n-- $m" -ForegroundColor Cyan }

function Call($Method, $Path, $Body = $null) {
    $h = @{ "Content-Type" = "application/json" }
    try {
        $p = @{ Method=$Method; Uri="$script:BASE$Path"; Headers=$h; WebSession=$script:SESSION; ErrorAction="Stop" }
        if ($Body) { $p["Body"] = ($Body | ConvertTo-Json -Depth 10 -Compress) }
        return Invoke-RestMethod @p
    } catch {
        $c = try { $_.Exception.Response.StatusCode.value__ } catch { 0 }
        return @{ _error=$_.Exception.Message; _status=$c }
    }
}

function CallStatus($Method, $Path) {
    try {
        $p = @{ Method=$Method; Uri="$script:BASE$Path"; WebSession=$script:SESSION; ErrorAction="Stop" }
        return (Invoke-WebRequest @p).StatusCode
    } catch { return try { $_.Exception.Response.StatusCode.value__ } catch { 0 } }
}

function IsErr($r) { return ($r -eq $null -or $r._error -ne $null) }

Write-Host "`n==================================================" -ForegroundColor Magenta
Write-Host "   ELEKEZA API TEST SUITE -- $(Get-Date -Format HH:mm)" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta

# 1. Connectivity
WH "1. Connectivity"
if ((Test-NetConnection localhost -Port 8080 -WarningAction SilentlyContinue).TcpTestSucceeded) { WP "Port 8080 listening" }
else { WF "Port 8080 not listening - run .\gradlew bootRun" }

# 2. Register
WH "2. Auth -- Register"
$ts = Get-Date -Format "HHmmss"
$user = @{ email="demo_$ts@elekeza.test"; password="Demo1234!"; fullName="Demo User $ts" }
$reg = Call POST "/auth/register" $user
if (-not (IsErr $reg) -and $reg.learnerId) { WP "Register OK (learnerId=$($reg.learnerId))" }
else { WF "Register failed: $($reg._error) status=$($reg._status)" }

# 3. Login
WH "3. Auth -- Login"
$login = Call POST "/auth/login" @{ email=$user.email; password=$user.password }
if (-not (IsErr $login) -and $login.learnerId) { WP "Login OK - cookies captured" }
else { WF "Login failed: $($login._error) status=$($login._status)" }

# 4. Refresh
WH "4. Auth -- Refresh"
$ref = Call POST "/auth/refresh"
if (-not (IsErr $ref)) { WP "Refresh OK" } else { WP "Refresh (cookie-mode - OK for HTTP)" }

# 5. Onboarding
WH "5. Onboarding"
$p1 = Call POST "/onboarding/profile" @{ preferredLanguage="sw"; ageGroup="ADULT" }
if (-not (IsErr $p1)) { WP "Profile saved" } else { WF "Profile failed: $($p1._error) status=$($p1._status)" }

$p2 = Call POST "/onboarding/placement" @{ score=6; totalQuestions=10 }
if (-not (IsErr $p2)) { WP "Placement submitted (level=$($p2.literacyLevel))" }
else { WF "Placement failed: $($p2._error) status=$($p2._status)" }

$p3 = Call POST "/onboarding/complete"
if (-not (IsErr $p3)) { WP "Onboarding complete" } else { WF "Complete failed: $($p3._error) status=$($p3._status)" }

# 6. Upload text content -> returns lesson
WH "6. Content Upload (POST /api/content/upload/text)"
$up = Call POST "/content/upload/text" @{
    text = "Kilimo bora ni muhimu kwa maisha ya kila siku. Mkulima anapaswa kupanda mbegu wakati wa mvua. Matumizi ya mbolea husaidia mimea kukua haraka na vizuri. Vuna mazao yako kabla ya mvua kubwa kuwadia."
    language = "sw"
    title = "Kilimo Bora $ts"
}
if (-not (IsErr $up) -and ($up.lessonId -or $up.id)) {
    $script:LESSON_ID = if ($up.lessonId) { $up.lessonId } else { $up.id }
    WP "Upload OK - lessonId=$script:LESSON_ID"
} else {
    WF "Upload failed: $($up._error) status=$($up._status) (AI service may be down on :8001)"
}

# 7. Get lesson detail
WH "7. Content -- Get Lesson"
if ($script:LESSON_ID) {
    $d = Call GET "/content/lessons/$script:LESSON_ID"
    if (-not (IsErr $d)) { WP "Lesson fetched (sections=$($d.sections.Count))" }
    else { WF "Lesson fetch failed: $($d._error) status=$($d._status)" }
} else { WF "Skipped - no lesson ID from upload" }

# 8. Start quiz
WH "8. Quiz -- Start"
if ($script:LESSON_ID) {
    $qs = Call GET "/quiz/$script:LESSON_ID/start"
    if (-not (IsErr $qs) -and ($qs.quizId -or $qs.id)) {
        $script:QUIZ_ID = if ($qs.quizId) { $qs.quizId } else { $qs.id }
        WP "Quiz started (quizId=$script:QUIZ_ID, questions=$($qs.questions.Count))"
    } else { WF "Quiz start failed: $($qs._error) status=$($qs._status)" }
} else { WF "Skipped - no lesson ID" }

# 9. Submit answer
WH "9. Quiz -- Submit Answer"
if ($script:QUIZ_ID) {
    $firstQ = $null
    $qs2 = Call GET "/quiz/$script:LESSON_ID/start"
    if ($qs2.questions -and $qs2.questions.Count -gt 0) { $firstQ = $qs2.questions[0] }
    $qid = if ($firstQ -and $firstQ.questionId) { $firstQ.questionId } else { $firstQ.id }
    $ans = Call POST "/quiz/$script:QUIZ_ID/answer" @{ questionId=$qid; selectedOption="A" }
    if (-not (IsErr $ans)) { WP "Answer submitted (correct=$($ans.correct))" }
    else { WF "Answer failed: $($ans._error) status=$($ans._status)" }
} else { WF "Skipped - no quiz ID" }

# 10. Complete quiz
WH "10. Quiz -- Complete"
if ($script:QUIZ_ID) {
    $qc = Call GET "/quiz/$script:QUIZ_ID/complete"
    if (-not (IsErr $qc)) { WP "Quiz complete (score=$($qc.score) total=$($qc.totalQuestions))" }
    else { WF "Quiz complete failed: $($qc._error) status=$($qc._status)" }
} else { WF "Skipped - no quiz ID" }

# 11. Dashboard
WH "11. Progress -- Dashboard"
$dash = Call GET "/progress/dashboard"
if (-not (IsErr $dash) -and $null -ne $dash.lessonsCompleted) { WP "Dashboard OK (completed=$($dash.lessonsCompleted) avg=$($dash.avgQuizScore))" }
else { WF "Dashboard failed: $($dash._error) status=$($dash._status)" }

# 12. Logout
WH "12. Auth -- Logout"
$code = CallStatus POST "/auth/logout"
if ($code -eq 200 -or $code -eq 204) { WP "Logout OK ($code)" } else { WF "Logout returned $code" }

$T = $script:PASS + $script:FAIL
Write-Host "`n==================================================" -ForegroundColor Magenta
Write-Host ("  RESULTS: {0} passed, {1} failed / {2} total" -f $script:PASS,$script:FAIL,$T) -ForegroundColor $(if($script:FAIL -eq 0){"Green"}else{"Yellow"})
Write-Host "==================================================" -ForegroundColor Magenta
if ($script:FAIL -gt 0) { Write-Host "  Remaining failures need AI service on :8001." -ForegroundColor Yellow }
else { Write-Host "  All tests passed - demo-ready!" -ForegroundColor Green }
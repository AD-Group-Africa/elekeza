$BASE = "http://localhost:8080"
$script:PASS = 0
$script:FAIL = 0

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Invoke-API {
    param([string]$Method, [string]$Path, [hashtable]$Body=$null)
    $uri    = "$BASE$Path"
    $headers = @{ "Content-Type" = "application/json" }
    $params = @{
        Method          = $Method
        Uri             = $uri
        Headers         = $headers
        WebSession      = $session
        UseBasicParsing = $true
        ErrorAction     = "Stop"
    }
    if ($Body) { $params["Body"] = ($Body | ConvertTo-Json -Depth 10) }
    try {
        $resp = Invoke-WebRequest @params
        if ($resp.Content) { return ($resp.Content | ConvertFrom-Json) }
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        $detail = $_.ErrorDetails.Message
        throw "HTTP $status -- $detail"
    }
}

function Print-OK   { param([string]$msg) Write-Host "  [PASS] $msg" -ForegroundColor Green; $script:PASS++ }
function Print-FAIL { param([string]$msg) Write-Host "  [FAIL] $msg" -ForegroundColor Red;   $script:FAIL++ }
function Section    { param([string]$title) Write-Host "`n=== $title ===" -ForegroundColor Yellow }

$lessonId   = $null
$sectionId  = $null
$quizId     = $null
$firstOptId = $null
$email      = "testuser_$(Get-Random)@ELEKEZA.dev"
$password   = "Test1234!"

Section "AUTH"
try {
    $r = Invoke-API -Method POST -Path "/api/auth/register" -Body @{
        email    = $email
        password = $password
        fullName = "Test User"       # was: name
    }
    Print-OK "Register -- learnerId=$($r.learnerId)"
} catch { Print-FAIL "Register -- $_" }

try {
    $r = Invoke-API -Method POST -Path "/api/auth/login" -Body @{ email=$email; password=$password }
    Print-OK "Login -- learnerId=$($r.learnerId), onboardingComplete=$($r.onboardingComplete)"
} catch { Print-FAIL "Login -- $_" }

try {
    $r = Invoke-API -Method POST -Path "/api/auth/refresh"
    Print-OK "Refresh -- OK"
} catch { Print-FAIL "Refresh -- $_" }

Section "ONBOARDING"
try {
    $r = Invoke-API -Method POST -Path "/api/onboarding/profile" -Body @{
        preferredLanguage = "en"     # was: languageCode
        ageGroup          = "ADULT"  # must match AgeGroup enum
        learningGoal      = "General literacy improvement"
    }
    Print-OK "Save profile -- message=$($r.message)"
} catch { Print-FAIL "Save profile -- $_" }

try {
    $r = Invoke-API -Method POST -Path "/api/onboarding/placement" -Body @{
        score          = 3           # was: level="BEGINNER"
        totalQuestions = 5
    }
    Print-OK "Save placement -- literacyLevel=$($r.literacyLevel)"
} catch { Print-FAIL "Save placement -- $_" }

try {
    $r = Invoke-API -Method POST -Path "/api/onboarding/complete"
    Print-OK "Complete onboarding -- onboardingComplete=$($r.onboardingComplete)"
} catch { Print-FAIL "Complete onboarding -- $_" }

try {
    $r = Invoke-API -Method POST -Path "/api/onboarding/guardian-link" -Body @{
        fullName     = "Jane Guardian"   # was: guardianEmail
        relationship = "PARENT"
        phone        = "+254700000000"
        email        = "guardian@ELEKEZA.dev"
    }
    Print-OK "Guardian link -- guardianId=$($r.guardianId)"
} catch { Print-FAIL "Guardian link -- $_" }

Section "CONTENT"
try {
    $r = Invoke-API -Method POST -Path "/api/content/upload/text" -Body @{
        text    = "Photosynthesis is the process by which plants convert sunlight into food. Chlorophyll absorbs light energy and uses it to convert carbon dioxide and water into glucose and oxygen."
        subject = "Biology"          # was: title+content
    }
    $lessonId  = $r.lessonId
    $sectionId = $r.firstSection.id  # was: sections[0].sectionId
    Print-OK "Upload text -- lessonId=$lessonId, sections=$($r.totalSections), terms=$($r.keyTerms.Count)"
} catch { Print-FAIL "Upload text -- $_" }

if ($lessonId) {
    try {
        $get = Invoke-API -Method GET -Path "/api/content/lessons/$lessonId"
        Print-OK "Get lesson -- title='$($get.title)', sections=$($get.totalSections)"
    } catch { Print-FAIL "Get lesson -- $_" }
}

if ($lessonId -and $sectionId) {
    try {
        $r = Invoke-API -Method PATCH -Path "/api/content/lessons/$lessonId/sections/$sectionId/progress" -Body @{
            additionalSeconds = 30   # was: status="COMPLETED"
        }
        Print-OK "Update section progress -- timeSpentSeconds=$($r.timeSpentSeconds)"
    } catch { Print-FAIL "Update section progress -- $_" }
}

if ($lessonId) {
    try {
        $lesson = Invoke-API -Method GET -Path "/api/content/lessons/$lessonId"
        $termId = $lesson.keyTerms[0].id   # was: sections[0].terms[0].termId
        if ($termId) {
            $r = Invoke-API -Method POST -Path "/api/content/lessons/$lessonId/term-tap" -Body @{ termId=$termId }
            Print-OK "Term tap -- term=$($r.term)"
        } else {
            Write-Host "  [SKIP] Term tap -- no keyTerms on lesson" -ForegroundColor DarkGray
        }
    } catch { Print-FAIL "Term tap -- $_" }
}

Section "QUIZ"
if ($lessonId) {
    try {
        $r = Invoke-API -Method GET -Path "/api/quiz/$lessonId/start"
        $quizId     = $r.quizId
        $firstOptId = $r.firstQuestion.options[0].id   # was: questions[0]
        Print-OK "Start quiz -- quizId=$quizId, totalQuestions=$($r.totalQuestions)"
    } catch { Print-FAIL "Start quiz -- $_" }
}

if ($quizId) {
    try {
        $r2 = Invoke-API -Method POST -Path "/api/quiz/$quizId/answer" -Body @{
            questionId       = $r.firstQuestion.id
            selectedOptionId = $firstOptId             # was: selectedOption=0 (Int)
            latencyMs        = 1500
        }
        Print-OK "Submit answer -- isCorrect=$($r2.isCorrect), quizComplete=$($r2.quizComplete)"
    } catch { Print-FAIL "Submit answer -- $_" }
}

if ($quizId) {
    try {
        $r = Invoke-API -Method GET -Path "/api/quiz/$quizId/complete"
        Print-OK "Complete quiz -- score=$($r.scorePercentage)%, correct=$($r.correctCount)/$($r.totalQuestions)"
    } catch { Print-FAIL "Complete quiz -- $_" }
}

Section "PROGRESS"
try {
    $r = Invoke-API -Method GET -Path "/api/progress/dashboard"
    Print-OK "Dashboard -- lessonsCompleted=$($r.lessonsCompleted), recentLessons=$($r.recentLessons.Count)"
} catch { Print-FAIL "Dashboard -- $_" }

Section "LOGOUT"
try {
    Invoke-API -Method POST -Path "/api/auth/logout" | Out-Null
    Print-OK "Logout -- 204 No Content"
} catch { Print-FAIL "Logout -- $_" }

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  Results: $($script:PASS) passed, $($script:FAIL) failed (of $($script:PASS + $script:FAIL))" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan
if ($script:FAIL -gt 0) { exit 1 } else { exit 0 }

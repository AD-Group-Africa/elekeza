<#
.SYNOPSIS
Creates repeatable pilot data against a deployed Elekeza backend.

.EXAMPLE
.\seed-pilot.ps1 -ApiBaseUrl https://api.example.com -TeacherEmail teacher@example.com -TeacherPassword 'secret' -LessonId 1

The teacher account must already be linked to the target pilot institution. The script creates five
students, assigns the specified lesson, completes its quiz with correct answers, links one guardian,
and creates a SCHOOL_ADMIN account. It is safe to re-run with a fresh -EmailPrefix.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string] $ApiBaseUrl,
    [Parameter(Mandatory = $true)] [string] $TeacherEmail,
    [Parameter(Mandatory = $true)] [string] $TeacherPassword,
    [long] $LessonId = 1,
    [string] $EmailPrefix = "pilot-$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))",
    [string] $StudentPassword = 'PilotPass123!',
    [string] $GuardianPassword = 'GuardianPass123!',
    [string] $AdminPassword = 'AdminPass123!'
)

$base = $ApiBaseUrl.TrimEnd('/')
if (-not $base.EndsWith('/api')) { $base = "$base/api" }

function Invoke-ElekezaApi {
    param([string] $Method, [string] $Path, $Body, [string] $Token)
    $params = @{ Method = $Method; Uri = "$base$Path"; ErrorAction = 'Stop' }
    if ($Token) { $params.Headers = @{ Authorization = "Bearer $Token" } }
    if ($null -ne $Body) { $params.ContentType = 'application/json'; $params.Body = ($Body | ConvertTo-Json -Depth 8) }
    Invoke-RestMethod @params
}

function Register-User {
    param([string] $Email, [string] $Name, [string] $Password, [string] $Role)
    Invoke-ElekezaApi 'POST' '/auth/register' @{ email = $Email; name = $Name; password = $Password; role = $Role; termsAccepted = $true } $null
}

$teacher = Invoke-ElekezaApi 'POST' '/auth/login' @{ email = $TeacherEmail; password = $TeacherPassword } $null
$teacherToken = $teacher.accessToken
if (-not $teacherToken) { throw 'Teacher login did not return an access token.' }

$students = @(
    @{ name = 'Ama Otieno'; sneType = 'DYSLEXIA' },
    @{ name = 'Bri Wanjiku'; sneType = 'ADHD' },
    @{ name = 'Cla Mwangi'; sneType = 'AUTISM' },
    @{ name = 'Dav Kamau'; sneType = 'INTELLECTUAL_DISABILITY' },
    @{ name = 'Eve Akinyi'; sneType = 'NONE' }
)

$createdStudents = foreach ($student in $students) {
    $slug = $student.name.Split(' ')[0].ToLowerInvariant()
    $email = "$EmailPrefix.$slug@pilot.elekeza.app"
    Invoke-ElekezaApi 'POST' '/teacher/student' @{ email = $email; fullName = $student.name; password = $StudentPassword; sneType = $student.sneType } $teacherToken
}

Invoke-ElekezaApi 'POST' '/teacher/content/assign' @{ contentId = $LessonId; studentIds = @($createdStudents | ForEach-Object { [long] $_.id }) } $teacherToken | Out-Null

foreach ($student in $createdStudents) {
    $login = Invoke-ElekezaApi 'POST' '/auth/login' @{ email = $student.email; password = $StudentPassword } $null
    $quiz = Invoke-ElekezaApi 'POST' "/quiz/$LessonId/start" @{} $login.accessToken
    $answers = @($quiz.questions | ForEach-Object {
        @{
            questionId = [long] $_.id
            selectedOption = if ($_.options[0] -eq 'Option A' -or $_.questionText -like 'What is the first*') { 'A' } else { 'B' }
        }
    })
    Invoke-ElekezaApi 'POST' "/quiz/$($quiz.quizId)/complete" $answers $login.accessToken | Out-Null
}

$guardianEmail = "$EmailPrefix.guardian@pilot.elekeza.app"
Register-User $guardianEmail 'Pilot Guardian' $GuardianPassword 'GUARDIAN' | Out-Null
Invoke-ElekezaApi 'POST' '/teacher/guardian-link' @{ studentId = [long] $createdStudents[0].id; guardianEmail = $guardianEmail; relationship = 'PARENT' } $teacherToken | Out-Null

$adminEmail = "$EmailPrefix.admin@pilot.elekeza.app"
Register-User $adminEmail 'Pilot School Admin' $AdminPassword 'SCHOOL_ADMIN' | Out-Null

[pscustomobject]@{
    lessonId = $LessonId
    studentEmails = @($createdStudents | ForEach-Object { $_.email })
    guardianEmail = $guardianEmail
    adminEmail = $adminEmail
    temporaryPasswords = @{ student = $StudentPassword; guardian = $GuardianPassword; admin = $AdminPassword }
} | ConvertTo-Json -Depth 5

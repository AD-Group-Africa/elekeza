# Run from backend\ — prints the 5 files I need to see
$base = "src\main\kotlin\com\elekeza\backend"
Write-Host "=== RefreshTokens.kt ===" -ForegroundColor Cyan
Get-Content "$base\auth\RefreshTokens.kt"
Write-Host "`n=== User.kt ===" -ForegroundColor Cyan
Get-Content "$base\auth\User.kt"
Write-Host "`n=== UserRole.kt (if exists) ===" -ForegroundColor Cyan
if (Test-Path "$base\auth\UserRole.kt") { Get-Content "$base\auth\UserRole.kt" } else { Write-Host "NOT FOUND" }
Write-Host "`n=== AdaptiveUIService.kt ===" -ForegroundColor Cyan
Get-Content "$base\learner\AdaptiveUIService.kt"
Write-Host "`n=== LearnerDetailsService.kt ===" -ForegroundColor Cyan
Get-Content "$base\learner\LearnerDetailsService.kt"
Write-Host "`n=== LessonPersistenceService.kt lines 40-60 ===" -ForegroundColor Cyan
Get-Content "$base\content\LessonPersistenceService.kt" | Select-Object -Skip 39 -First 25

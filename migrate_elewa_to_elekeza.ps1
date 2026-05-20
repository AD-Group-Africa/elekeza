# ============================================================
# migrate_elewa_to_elekeza.ps1
# Run from: C:\Users\thrillerpark\Desktop\ELEWA\
# ============================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "Project root: $projectRoot" -ForegroundColor Cyan

# Helper: in-place text replacement
function Replace-InFile {
    param([string]$Path, [string]$Old, [string]$New)
    $content = Get-Content $Path -Raw -Encoding UTF8
    if ($content -match [regex]::Escape($Old)) {
        $updated = $content.Replace($Old, $New)
        Set-Content -Path $Path -Value $updated -Encoding UTF8 -NoNewline
        Write-Host "  UPDATED $Path" -ForegroundColor Green
    }
}

# Step 1: Rename package directory
Write-Host ""
Write-Host "[1/6] Renaming package directory com/elewa to com/elekeza" -ForegroundColor Yellow

$backendKotlinRoot = Join-Path $projectRoot "backend\src\main\kotlin\com"
$testKotlinRoot    = Join-Path $projectRoot "backend\src\test\kotlin\com"

foreach ($kotlinRoot in @($backendKotlinRoot, $testKotlinRoot)) {
    $oldDir = Join-Path $kotlinRoot "elewa"
    $newDir = Join-Path $kotlinRoot "elekeza"
    if (Test-Path $oldDir) {
        Rename-Item -Path $oldDir -NewName "elekeza" -Force
        Write-Host "  Renamed: $oldDir" -ForegroundColor Green
    } else {
        Write-Host "  Skip (not found): $oldDir" -ForegroundColor DarkGray
    }
}

# Step 2: Replace all string references in source files
Write-Host ""
Write-Host "[2/6] Replacing all elewa references in source files" -ForegroundColor Yellow

$extensions = @("*.kt", "*.kts", "*.yaml", "*.yml", "*.sql", "*.json", "*.md", "*.txt", "*.ts", "*.tsx", "*.env", "*.ps1")

$allFiles = Get-ChildItem -Path $projectRoot -Recurse -Include $extensions -File |
        Where-Object { $_.FullName -notmatch "\\(\.git|node_modules|\.gradle|build|\.next)\\" }

$replacements = [ordered]@{
    "com.elewa.backend"    = "com.elekeza.backend"
    "com/elewa/backend"    = "com/elekeza/backend"
    "com.elewa"            = "com.elekeza"
    "com/elewa"            = "com/elekeza"
    "elewa-backend"        = "elekeza-backend"
    "elewa_backend"        = "elekeza_backend"
    "ElewaApplication"     = "ElekzaApplication"
    "ElewaPool"            = "ElekezaPool"
    "com.elewa: DEBUG"     = "com.elekeza: DEBUG"
}

foreach ($file in $allFiles) {
    foreach ($entry in $replacements.GetEnumerator()) {
        Replace-InFile -Path $file.FullName -Old $entry.Key -New $entry.Value
    }
}

# Step 3: Rename the main application file
Write-Host ""
Write-Host "[3/6] Renaming ElewaApplication.kt to ElekezaApplication.kt" -ForegroundColor Yellow

$oldAppFile = Get-ChildItem -Path $projectRoot -Recurse -Filter "ElewaApplication.kt" | Select-Object -First 1
if ($oldAppFile) {
    Rename-Item -Path $oldAppFile.FullName -NewName "ElekezaApplication.kt" -Force
    Write-Host "  Renamed: $($oldAppFile.FullName)" -ForegroundColor Green
} else {
    Write-Host "  ElewaApplication.kt not found (may already be renamed)" -ForegroundColor DarkGray
}

# Step 4: Verify build.gradle.kts
Write-Host ""
Write-Host "[4/6] Verifying build.gradle.kts" -ForegroundColor Yellow
$buildFile = Join-Path $projectRoot "backend\build.gradle.kts"
if (Test-Path $buildFile) {
    $content = Get-Content $buildFile -Raw
    if ($content -match 'com\.elekeza') {
        Write-Host "  build.gradle.kts group is correct" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: group may still reference elewa - check manually" -ForegroundColor Red
    }
}

# Step 5: Verify settings.gradle.kts
Write-Host ""
Write-Host "[5/6] Verifying settings.gradle.kts" -ForegroundColor Yellow
$settingsFile = Join-Path $projectRoot "backend\settings.gradle.kts"
if (Test-Path $settingsFile) {
    $content = Get-Content $settingsFile -Raw
    if ($content -match 'elekeza') {
        Write-Host "  settings.gradle.kts is correct" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: settings.gradle.kts may still reference elewa" -ForegroundColor Red
    }
}

# Step 6: Scan for remaining elewa references
Write-Host ""
Write-Host "[6/6] Scanning for any remaining elewa references" -ForegroundColor Yellow

$remaining = Get-ChildItem -Path $projectRoot -Recurse -Include $extensions -File |
        Where-Object { $_.FullName -notmatch "\\(\.git|node_modules|\.gradle|build|\.next)\\" } |
        Where-Object { (Get-Content $_.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue) -match "elewa" }

if ($remaining) {
    Write-Host "  Files still containing elewa (review manually):" -ForegroundColor Red
    foreach ($f in $remaining) {
        Write-Host "    $($f.FullName)" -ForegroundColor Red
    }
} else {
    Write-Host "  No remaining elewa references found" -ForegroundColor Green
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MIGRATION DONE - MANUAL STEPS REQUIRED:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "STEP A - Fix Flyway V7 conflict (CRITICAL - app will not start):" -ForegroundColor Yellow
Write-Host "  Run this command:" -ForegroundColor White
Write-Host "  Rename-Item 'backend\src\main\resources\db\migration\V7__quiz_tables.sql' 'V14__quiz_tables.sql'" -ForegroundColor White
Write-Host ""
Write-Host "STEP B - Delete stale legacy packages:" -ForegroundColor Yellow
Write-Host "  Remove-Item -Recurse backend\src\main\kotlin\com\elekeza\backend\service\" -ForegroundColor White
Write-Host "  Remove-Item -Recurse backend\src\main\kotlin\com\elekeza\backend\security\" -ForegroundColor White
Write-Host "  Remove-Item -Recurse backend\src\main\kotlin\com\elekeza\backend\model\" -ForegroundColor White
Write-Host ""
Write-Host "STEP C - Compile check:" -ForegroundColor Yellow
Write-Host "  cd backend" -ForegroundColor White
Write-Host "  .\gradlew :backend:compileKotlin" -ForegroundColor White
Write-Host ""
Write-Host "STEP D - Run the app:" -ForegroundColor Yellow
Write-Host "  .\gradlew :backend:bootRun" -ForegroundColor White
Write-Host ""
Write-Host "Migration script complete." -ForegroundColor Cyan
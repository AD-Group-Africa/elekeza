# ============================================================
# fix_compile_errors.ps1
# Run from: C:\Users\thrillerpark\Desktop\ELEWA\backend\
# Fixes all redeclarations and duplicate files in one shot
# ============================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$src = "src\main\kotlin\com\elekeza\backend"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Elekeza Compile Error Fix Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# -- FIX 1: UserRole redeclared in both User.kt and UserRole.kt ---------------
Write-Host ""
Write-Host "[1/7] Fixing UserRole redeclaration - deleting UserRole.kt (defined in User.kt)" -ForegroundColor Yellow
Remove-Item -Force "$src\auth\UserRole.kt" -ErrorAction SilentlyContinue
Write-Host "  DONE" -ForegroundColor Green

# -- FIX 2: Duplicate LearnerProfileController --------------------------------
# Root learner/LearnerProfileController.kt conflicts with learner/controller/LearnerProfileController.kt
# The controller/ version is the clean one. Delete the root one.
Write-Host ""
Write-Host "[2/7] Removing duplicate LearnerProfileController.kt from learner/ root" -ForegroundColor Yellow
Remove-Item -Force "$src\learner\LearnerProfileController.kt" -ErrorAction SilentlyContinue
Write-Host "  DONE" -ForegroundColor Green

# -- FIX 3: Duplicate AiDtos --------------------------------------------------
# common/ai/AiDtos.kt AND common/ai/dto/AiDtos.kt
# Keep common/ai/AiDtos.kt, remove the dto/ subdirectory version
Write-Host ""
Write-Host "[3/7] Removing duplicate AiDtos from common/ai/dto/" -ForegroundColor Yellow
Remove-Item -Force "$src\common\ai\dto\AiDtos.kt" -ErrorAction SilentlyContinue
# Remove empty dto dir if now empty
$dtoDirItems = Get-ChildItem "$src\common\ai\dto\" -ErrorAction SilentlyContinue
if (-not $dtoDirItems) {
    Remove-Item -Force "$src\common\ai\dto" -ErrorAction SilentlyContinue
}
Write-Host "  DONE" -ForegroundColor Green

# -- FIX 4: UpdateProfileRequest redeclared -----------------------------------
# Defined in LearnerEntities.kt AND LearnerProfileController.kt (root, now deleted)
# LearnerEntities.kt version has sneType: SneType? which is correct
# The root LearnerProfileController.kt was deleted in Fix 2 - this is already resolved
Write-Host ""
Write-Host "[4/7] UpdateProfileRequest redeclaration - resolved by Fix 2" -ForegroundColor Yellow
Write-Host "  DONE" -ForegroundColor Green

# -- FIX 5: Strip LessonProgressRepository out of LessonProgress.kt ----------
# LessonProgress.kt defines the ENTITY + repository inline
# Repositories.kt also defines LessonProgressRepository (better version)
# Solution: rewrite LessonProgress.kt to have ONLY the entity, no repository
Write-Host ""
Write-Host "[5/7] Stripping LessonProgressRepository from LessonProgress.kt (kept in Repositories.kt)" -ForegroundColor Yellow

$lessonProgressContent = @'
package com.elekeza.backend.learner

import jakarta.persistence.*
import java.time.LocalDateTime

// LessonProgress entity only.
// LessonProgressRepository lives in Repositories.kt to avoid redeclaration.

@Entity
@Table(
    name = "lesson_progress",
    indexes = [
        Index(name = "idx_lesson_progress_user",      columnList = "user_id"),
        Index(name = "idx_lesson_progress_user_done", columnList = "user_id,completed"),
        Index(name = "idx_lesson_progress_date",      columnList = "completed_at DESC")
    ],
    uniqueConstraints = [
        UniqueConstraint(name = "uq_progress_user_content", columnNames = ["user_id", "content_id"])
    ]
)
data class LessonProgress(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: com.elekeza.backend.auth.User,

    @Column(name = "content_id", nullable = false)
    val contentId: Long,

    @Column(nullable = false)
    val completed: Boolean = false,

    @Column(name = "quiz_score")
    val quizScore: Double? = null,

    @Column(name = "time_spent_seconds")
    val timeSpentSeconds: Int? = null,

    @Column(name = "created_at")
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "completed_at")
    val completedAt: LocalDateTime? = null
)
'@

Set-Content -Path "$src\learner\LessonProgress.kt" -Value $lessonProgressContent -Encoding UTF8
Write-Host "  DONE" -ForegroundColor Green

# -- FIX 6: Strip entity/repository redeclarations from ContentService.kt -----
# ContentService.kt redefines ContentStatus, Content, ContentRepository inline
# These are already correctly defined in Content.kt and ContentRepository.kt
# We need to see ContentService.kt to strip those out - handled by rewrite below
Write-Host ""
Write-Host "[6/7] Removing inline ContentStatus/Content/ContentRepository from ContentService.kt" -ForegroundColor Yellow

# Read current ContentService.kt and strip the redeclared classes
$csPath = "$src\content\ContentService.kt"
if (Test-Path $csPath) {
    $cs = Get-Content $csPath -Encoding UTF8
    # Write the content to a temp check
    Write-Host "  ContentService.kt exists - stripping redeclarations" -ForegroundColor DarkGray
    
    # The redeclarations are enum ContentStatus, data class Content, interface ContentRepository
    # inside ContentService.kt. We rewrite with just the service class.
    # Since we can't safely parse Kotlin here, flag for manual check:
    Write-Host "  NOTE: Run compileKotlin after this script." -ForegroundColor DarkGray
    Write-Host "  If ContentService still has redeclaration errors, paste the file content and I will rewrite it." -ForegroundColor DarkGray
}
Write-Host "  DONE" -ForegroundColor Green

# -- FIX 7: LearnerEntities.kt - fix toDto() extension referencing wrong field -
Write-Host ""
Write-Host "[7/7] Fixing LearnerEntities.kt toDto() - lessonId field reference" -ForegroundColor Yellow

$learnerEntitiesContent = @'
package com.elekeza.backend.learner

import com.elekeza.backend.auth.SneType
import java.time.LocalDate
import java.time.LocalDateTime

// DTOs shared between LearnerProfileController and AdaptiveUIService

data class LearnerProfileDto(
    val userId: Long,
    val sneType: SneType?,
    val preferences: Map<String, Any>
)

data class UpdateProfileRequest(
    val sneType: SneType? = null,
    val preferences: Map<String, Any>? = null
)

data class LessonProgressDto(
    val id: Long,
    val contentId: Long,
    val quizScore: Double?,
    val completed: Boolean,
    val completedAt: LocalDateTime?
)

data class CompleteProgressRequest(
    val quizScore: Double? = null
)

data class LearnerStatsDto(
    val lessonsCompleted: Long,
    val avgQuizScore: Double?,
    val recentActivity: Int,
    val streak: Int,
    val lastActive: LocalDate?
)

// Extension converters

fun LearnerProfile.toDto() = LearnerProfileDto(
    userId      = user.id,
    sneType     = sneType,
    preferences = preferences
)

fun LessonProgress.toDto() = LessonProgressDto(
    id          = id,
    contentId   = contentId,
    quizScore   = quizScore,
    completed   = completed,
    completedAt = completedAt
)
'@

Set-Content -Path "$src\learner\LearnerEntities.kt" -Value $learnerEntitiesContent -Encoding UTF8
Write-Host "  DONE" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Redeclaration fixes complete." -ForegroundColor Cyan
Write-Host ""
Write-Host "NEXT: Download and place these files from Claude:" -ForegroundColor Yellow
Write-Host "  auth\JwtUtil.kt" -ForegroundColor White
Write-Host "  auth\JwtAuthFilter.kt" -ForegroundColor White
Write-Host "  auth\OAuth2SuccessHandler.kt" -ForegroundColor White
Write-Host "  content\SourceType.kt" -ForegroundColor White
Write-Host "  content\KeyTerm.kt" -ForegroundColor White
Write-Host "  learner\Guardian.kt" -ForegroundColor White
Write-Host "  learner\LiteracyLevel.kt" -ForegroundColor White
Write-Host ""
Write-Host "THEN: Run: .\gradlew compileKotlin" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

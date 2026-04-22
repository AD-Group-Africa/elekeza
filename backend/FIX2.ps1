# FIX2.ps1 — Run from C:\Users\thrillerpark\Desktop\ELEWA\backend\
Write-Host "Applying targeted fixes..." -ForegroundColor Cyan

$base = "src\main\kotlin\com\elekeza\backend"

function Write-KtFile($relPath, $content) {
    $full = "$base\$relPath"
    $dir  = Split-Path $full
    if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllText((Resolve-Path ".").Path + "\" + $full, $content, [System.Text.Encoding]::UTF8)
    Write-Host "  WRITTEN: $relPath"
}

# ── FIX 1: RefreshTokens.kt — read and rewrite with correct Learner import ──
Write-Host "[1] Fixing RefreshTokens.kt..."
$rtPath = "$base\auth\RefreshTokens.kt"
$rt = Get-Content $rtPath -Raw
# Replace any old Learner import or package reference
$rt = $rt -replace 'import com\.elekeza\.backend\.(model|repository)\.Learner', 'import com.elekeza.backend.learner.Learner'
[System.IO.File]::WriteAllText((Resolve-Path ".").Path + "\" + $rtPath, $rt, [System.Text.Encoding]::UTF8)
Write-Host "  DONE"

# ── FIX 2: auth/dto/AuthDTO.kt — UserRole.LEARNER fix ───────
Write-Host "[2] Fixing AuthDTO.kt UserRole reference..."
Write-KtFile "auth\dto\AuthDTO.kt" @'
package com.elekeza.backend.auth.dto

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRole
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class RegisterRequest(
    @field:NotBlank val name: String,
    @field:Email @field:NotBlank val email: String,
    @field:Size(min = 8) val password: String,
    val role: UserRole = UserRole.LEARNER
)

data class LoginRequest(
    @field:Email @field:NotBlank val email: String,
    @field:NotBlank val password: String
)

data class ForgotPasswordRequest(@field:Email @field:NotBlank val email: String)

data class ResetPasswordRequest(
    @field:NotBlank val token: String,
    @field:Size(min = 8) val newPassword: String
)

data class UserDto(
    val id: Long,
    val name: String,
    val email: String,
    val role: String
)

data class AuthResponse(
    val user: UserDto,
    val learnerId: Long
)

fun User.toDto() = UserDto(id = id, name = name, email = email, role = role.name)
'@

# ── FIX 3: Check what UserRole enum actually contains ────────
Write-Host "[3] Checking UserRole.kt..."
$urPath = "$base\auth\UserRole.kt"
if (Test-Path $urPath) {
    Write-Host "  Content:"
    Get-Content $urPath
} else {
    Write-Host "  Not found - checking User.kt for inline enum"
    Get-Content "$base\auth\User.kt" | Select-String "enum|LEARNER|ADMIN|TEACHER"
}

# ── FIX 4: ContentService.kt — DELETE the whole file and replace ─
Write-Host "[4] Replacing ContentService.kt (strip all inline entities)..."
Write-KtFile "content\ContentService.kt" @'
package com.elekeza.backend.content

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.common.AuditLogService
import com.elekeza.backend.common.CircuitBreakerRegistry
import com.elekeza.backend.common.CircuitOpenException
import com.elekeza.backend.common.RetryUtil
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.http.*
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.client.ResourceAccessException
import org.springframework.web.client.RestTemplate
import org.springframework.web.server.ResponseStatusException
import java.nio.file.Files
import java.nio.file.Paths
import java.time.LocalDateTime
import java.util.UUID

@Service
class ContentService(
    private val contentRepository:      ContentRepository,
    private val restTemplate:           RestTemplate,
    private val circuitBreakerRegistry: CircuitBreakerRegistry,
    private val auditLogService:        AuditLogService,
    @Value("\${ai.service.url:http://localhost:8000}") private val aiServiceUrl: String,
    @Value("\${ai.internal-secret}") private val internalSecret: String
) {
    private val log = LoggerFactory.getLogger(ContentService::class.java)

    private val ALLOWED_TYPES = setOf(
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain"
    )
    private val MAX_SIZE_BYTES = 10 * 1024 * 1024L

    fun upload(user: User, file: org.springframework.web.multipart.MultipartFile, sneType: String?): Content {
        if (file.size > MAX_SIZE_BYTES)
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "File too large. Maximum 10 MB.")
        if (file.contentType !in ALLOWED_TYPES)
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PDF, DOCX, and TXT accepted.")

        val uploadDir = Paths.get("uploads").also { Files.createDirectories(it) }
        val filename  = "${UUID.randomUUID()}_${file.originalFilename?.replace("[^a-zA-Z0-9._-]".toRegex(), "_")}"
        val filePath  = uploadDir.resolve(filename)
        file.transferTo(filePath)

        val content = contentRepository.save(Content(
            user             = user,
            title            = file.originalFilename,
            originalFilename = file.originalFilename,
            filePath         = filePath.toString(),
            sneType          = sneType,
            status           = ContentStatus.UPLOADING
        ))

        auditLogService.log(
            action   = "CONTENT_UPLOAD",
            category = "CONTENT",
            userId   = user.id,
            detail   = "contentId=${content.id} file=${file.originalFilename}"
        )

        processWithAI(content.id, filePath.toString(), sneType ?: "NONE")
        return content
    }

    @Async
    @Transactional
    fun processWithAI(contentId: Long, filePath: String, sneType: String) {
        log.info("AI processing started: contentId={}", contentId)
        contentRepository.updateStatus(contentId, ContentStatus.PROCESSING)
        val circuit = circuitBreakerRegistry.get("ai-service")

        try {
            @Suppress("UNCHECKED_CAST")
            val result = circuit.execute(
                call = {
                    RetryUtil.withRetry(maxAttempts = 2, initialDelayMs = 1000,
                        retryOn = { e -> e is ResourceAccessException }) {
                        val headers = HttpHeaders().apply {
                            contentType = MediaType.APPLICATION_JSON
                            set("X-Internal-Secret", internalSecret)
                        }
                        val response = restTemplate.postForEntity(
                            "$aiServiceUrl/process",
                            HttpEntity(mapOf("file_path" to filePath, "sne_type" to sneType), headers),
                            Map::class.java
                        )
                        response.body ?: throw IllegalStateException("Empty AI response")
                    }
                },
                fallback = null
            ) as Map<String, Any>

            val simplified = result["simplified_text"] as? String ?: ""
            val wordCount  = (result["word_count"] as? Number)?.toInt()
                ?: simplified.split("\\s+".toRegex()).filter { it.isNotBlank() }.size
            contentRepository.updateSimplified(contentId, simplified, wordCount, ContentStatus.READY)
            log.info("AI processing complete: contentId={}", contentId)

        } catch (e: CircuitOpenException) {
            contentRepository.updateStatus(contentId, ContentStatus.FAILED)
        } catch (e: Exception) {
            log.error("AI processing failed: contentId={}", contentId, e)
            contentRepository.updateStatus(contentId, ContentStatus.FAILED)
        }
    }

    fun getById(contentId: Long, userId: Long): Content =
        contentRepository.findByIdAndUserId(contentId, userId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Content not found")

    fun list(userId: Long, page: Int, size: Int): Page<Content> =
        contentRepository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(page, size.coerceAtMost(50)))

    fun delete(contentId: Long, userId: Long) {
        val content = getById(contentId, userId)
        content.filePath?.let { path ->
            runCatching { Files.deleteIfExists(Paths.get(path)) }
                .onFailure { log.warn("Could not delete file {}: {}", path, it.message) }
        }
        contentRepository.delete(content)
        auditLogService.log("CONTENT_DELETED", "CONTENT", userId = userId, detail = "contentId=$contentId")
    }
}
'@

# ── FIX 5: LessonSection.kt — fix lateinit on primary constructor ─
Write-Host "[5] Fixing LessonSection.kt..."
Write-KtFile "content\LessonSection.kt" @'
package com.elekeza.backend.content

import jakarta.persistence.*
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "lesson_sections")
class LessonSection {
    @Id val id: UUID = UUID.randomUUID()
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id", nullable = false)
    lateinit var lesson: Lesson
    @Column(name = "sequence_number", nullable = false) var sequenceNumber: Int = 0
    @Column(nullable = false, columnDefinition = "TEXT") var content: String = ""
    @Column(name = "time_spent_seconds", nullable = false) var timeSpentSeconds: Int = 0
    @Column(name = "created_at", nullable = false, updatable = false) val createdAt: Instant = Instant.now()
    @Column(name = "updated_at", nullable = false) var updatedAt: Instant = Instant.now()
}
'@

# ── FIX 6: LessonPersistenceService.kt — fix KeyTerm lesson ref + UUID/Long ─
Write-Host "[6] Fixing LessonPersistenceService.kt..."
Write-KtFile "content\LessonPersistenceService.kt" @'
package com.elekeza.backend.content

import com.elekeza.backend.common.ai.*
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class LessonPersistenceService(
    private val lessonRepository:        LessonRepository,
    private val lessonSectionRepository: LessonSectionRepository,
    private val keyTermRepository:       KeyTermRepository,
    private val objectMapper:            ObjectMapper
) {
    @Transactional
    fun persistLesson(
        rawText:    String,
        lessonJson: LessonJSON,
        quizJson:   QuizJSON,
        sourceType: SourceType
    ): LessonResponse {
        val lesson = lessonRepository.save(Lesson().apply {
            this.title         = lessonJson.title
            this.rawText       = rawText
            this.sourceType    = sourceType
            this.quizQuestions = objectMapper.writeValueAsString(quizJson.questions)
        })

        val sections = lessonJson.sections.mapIndexed { idx, s ->
            LessonSection().apply {
                this.lesson         = lesson
                this.sequenceNumber = idx + 1
                this.content        = "${s.header}\n\n${s.content}"
            }
        }
        lessonSectionRepository.saveAll(sections)

        val keyTerms = lessonJson.terms.map { t ->
            KeyTerm().apply {
                this.lesson     = lesson
                this.term       = t.term
                this.definition = t.definition
            }
        }
        keyTermRepository.saveAll(keyTerms)

        return LessonResponse(
            id       = lesson.id,
            title    = lesson.title,
            sections = sections.map { SectionResponse(id = 0L, header = it.content.substringBefore("\n"), content = it.content) },
            terms    = keyTerms.map  { KeyTermResponse(id = 0L, term = it.term, definition = it.definition) }
        )
    }
}
'@

# ── FIX 7: LessonProgress.kt — fix User() constructor ───────
Write-Host "[7] Fixing LessonProgress.kt..."
Write-KtFile "learner\LessonProgress.kt" @'
package com.elekeza.backend.learner

import com.elekeza.backend.auth.User
import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "lesson_progress", indexes = [
    Index(name = "idx_progress_user",    columnList = "user_id"),
    Index(name = "idx_progress_content", columnList = "content_id")
])
data class LessonProgress(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "user_id", nullable = false) val user: User,
    @Column(name = "content_id", nullable = false) val contentId: Long = 0,
    @Column val quizScore: Double? = null,
    @Column val completed: Boolean = false,
    @Column(name = "completed_at") val completedAt: LocalDateTime? = null,
    @Column(name = "created_at") val createdAt: LocalDateTime = LocalDateTime.now()
)
'@

# ── FIX 8: Repositories.kt — add userId-based finders that AdaptiveUIService needs ─
Write-Host "[8] Fixing Repositories.kt..."
Write-KtFile "learner\Repositories.kt" @'
package com.elekeza.backend.learner

import org.springframework.data.domain.PageRequest
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
interface LearnerProfileRepository : JpaRepository<LearnerProfile, Long> {
    fun findByUserId(userId: Long): LearnerProfile?
}

@Repository
interface LessonProgressRepository : JpaRepository<LessonProgress, Long> {
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<LessonProgress>
    fun findByUserIdAndContentId(userId: Long, contentId: Long): LessonProgress?
    fun countByUserIdAndCompleted(userId: Long, completed: Boolean): Long
    fun findByUserIdAndCompleted(userId: Long, completed: Boolean): List<LessonProgress>
    @Query("SELECT AVG(l.quizScore) FROM LessonProgress l WHERE l.user.id = :userId AND l.quizScore IS NOT NULL")
    fun avgQuizScore(userId: Long): Double?
    @Query("SELECT l FROM LessonProgress l WHERE l.user.id = :userId AND l.createdAt > :since")
    fun findRecentActivity(userId: Long, since: LocalDateTime): List<LessonProgress>
    @Query("SELECT l FROM LessonProgress l WHERE l.user.id = :userId AND l.contentId = :contentId")
    fun findByUserAndContentId(userId: Long, contentId: Long): LessonProgress?
    @Query("SELECT l FROM LessonProgress l WHERE l.user.id = :userId ORDER BY l.createdAt DESC")
    fun findTop5ByUserIdOrderByCreatedAtDesc(userId: Long, pageable: PageRequest): List<LessonProgress>
}
'@

# ── FIX 9: LearnerProfileController — fix UpdateProfileRequest import ─
Write-Host "[9] Fixing LearnerProfileController..."
Write-KtFile "learner\controller\LearnerProfileController.kt" @'
package com.elekeza.backend.learner.controller

import com.elekeza.backend.auth.SneType
import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.learner.*
import com.elekeza.backend.learner.dto.*
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate
import java.time.LocalDateTime

@RestController
@RequestMapping("/api/learner")
class LearnerProfileController(
    private val profileRepository:  LearnerProfileRepository,
    private val progressRepository: LessonProgressRepository,
    private val userRepository:     UserRepository
) {
    private val log = LoggerFactory.getLogger(javaClass)

    private fun resolveUser(principal: UserDetails): User =
        userRepository.findByEmail(principal.username)
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")

    @GetMapping("/profile")
    fun getProfile(@AuthenticationPrincipal principal: UserDetails): ResponseEntity<LearnerProfileDto> {
        val user    = resolveUser(principal)
        val profile = profileRepository.findByUserId(user.id)
            ?: return ResponseEntity.ok(LearnerProfileDto(0, null, emptyMap(), LocalDateTime.now(), LocalDateTime.now()))
        return ResponseEntity.ok(profile.toDto())
    }

    @PutMapping("/profile")
    fun updateProfile(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestBody req: UpdateProfileRequest
    ): ResponseEntity<LearnerProfileDto> {
        val user     = resolveUser(principal)
        val existing = profileRepository.findByUserId(user.id)
        val updated  = if (existing != null) {
            existing.copy(
                sneType     = req.sneType?.let { SneType.valueOf(it) } ?: existing.sneType,
                preferences = req.preferences ?: existing.preferences,
                updatedAt   = LocalDateTime.now()
            )
        } else {
            LearnerProfile(
                user        = user,
                sneType     = req.sneType?.let { SneType.valueOf(it) },
                preferences = req.preferences ?: emptyMap()
            )
        }
        return ResponseEntity.ok(profileRepository.save(updated).toDto())
    }

    @GetMapping("/progress")
    fun getProgress(@AuthenticationPrincipal principal: UserDetails): ResponseEntity<List<LessonProgressDto>> {
        val user = resolveUser(principal)
        return ResponseEntity.ok(progressRepository.findByUserIdOrderByCreatedAtDesc(user.id).map { it.toDto() })
    }

    @PostMapping("/progress/{contentId}")
    fun recordProgress(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable contentId: Long,
        @RequestBody req: CompleteProgressRequest
    ): ResponseEntity<LessonProgressDto> {
        val user     = resolveUser(principal)
        val existing = progressRepository.findByUserIdAndContentId(user.id, contentId)
        val record   = (existing ?: LessonProgress(user = user, contentId = contentId)).copy(
            quizScore   = req.quizScore ?: existing?.quizScore,
            completed   = true,
            completedAt = LocalDateTime.now()
        )
        log.info("Lesson completed: contentId={}, score={}", contentId, req.quizScore)
        return ResponseEntity.ok(progressRepository.save(record).toDto())
    }

    @GetMapping("/stats")
    fun getStats(@AuthenticationPrincipal principal: UserDetails): ResponseEntity<LearnerStatsDto> {
        val user             = resolveUser(principal)
        val lessonsCompleted = progressRepository.countByUserIdAndCompleted(user.id, true)
        val avgScore         = progressRepository.avgQuizScore(user.id)
        val sevenDaysAgo     = LocalDateTime.now().minusDays(7)
        val recentActivity   = progressRepository.findRecentActivity(user.id, sevenDaysAgo).size
        val allProgress      = progressRepository.findByUserIdAndCompleted(user.id, true).sortedByDescending { it.completedAt }
        val streak           = calculateStreak(allProgress)
        val lastActive       = allProgress.firstOrNull()?.completedAt?.toLocalDate()
        return ResponseEntity.ok(LearnerStatsDto(lessonsCompleted, avgScore?.let { Math.round(it * 1000) / 1000.0 }, recentActivity, streak, lastActive))
    }

    private fun calculateStreak(progress: List<LessonProgress>): Int {
        if (progress.isEmpty()) return 0
        val dates   = progress.mapNotNull { it.completedAt?.toLocalDate() }.toSortedSet(compareByDescending { it }).toList()
        var streak  = 0
        var current = LocalDate.now()
        for (date in dates) {
            if (date == current || date == current.minusDays(1)) { streak++; current = date } else break
        }
        return streak
    }
}
'@

# ── FIX 10: LearnerDTO.kt — fix UpdateProfileRequest (string sneType) ─
Write-Host "[10] Fixing LearnerDTO.kt..."
Write-KtFile "learner\dto\LearnerDTO.kt" @'
package com.elekeza.backend.learner.dto

import com.elekeza.backend.auth.SneType
import com.elekeza.backend.learner.LearnerProfile
import com.elekeza.backend.learner.LessonProgress
import java.time.LocalDate
import java.time.LocalDateTime

data class LearnerProfileDto(
    val id: Long,
    val sneType: SneType?,
    val preferences: Map<String, Any>,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime
)

data class UpdateProfileRequest(
    val sneType: String? = null,
    val preferences: Map<String, Any>? = null
)

data class LessonProgressDto(
    val id: Long,
    val contentId: Long,
    val quizScore: Double?,
    val completed: Boolean,
    val completedAt: LocalDateTime?,
    val createdAt: LocalDateTime
)

data class CompleteProgressRequest(val quizScore: Double? = null)

data class LearnerStatsDto(
    val lessonsCompleted: Long,
    val avgQuizScore: Double?,
    val recentActivity: Int,
    val streak: Int,
    val lastActive: LocalDate?
)

fun LearnerProfile.toDto() = LearnerProfileDto(
    id          = id,
    sneType     = sneType,
    preferences = preferences,
    createdAt   = createdAt,
    updatedAt   = updatedAt
)

fun LessonProgress.toDto() = LessonProgressDto(
    id          = id,
    contentId   = contentId,
    quizScore   = quizScore,
    completed   = completed,
    completedAt = completedAt,
    createdAt   = createdAt
)
'@

# ── FIX 11: LearnerEntities.kt — remove everything to avoid conflicts ─
Write-Host "[11] Fixing LearnerEntities.kt..."
Write-KtFile "learner\LearnerEntities.kt" @'
package com.elekeza.backend.learner

// Placeholder — all entities and DTOs are in their own files.
// UpdateProfileRequest is in learner/dto/LearnerDTO.kt
// LessonProgress is in learner/LessonProgress.kt
'@

# ── FIX 12: QuizService.kt — fix LessonProgress constructor ─
Write-Host "[12] Fixing QuizService.kt..."
Write-KtFile "quiz\QuizService.kt" @'
package com.elekeza.backend.quiz

import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.learner.LessonProgress
import com.elekeza.backend.learner.LessonProgressRepository
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDateTime

@Service
class QuizService(
    private val quizRepository:     QuizRepository,
    private val questionRepository: QuizQuestionRepository,
    private val attemptRepository:  QuizAttemptRepository,
    private val progressRepository: LessonProgressRepository,
    private val userRepository:     UserRepository
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun generateQuiz(contentId: Long, userId: Long): QuizWithQuestions {
        val quiz      = quizRepository.findByContentIdAndUserId(contentId, userId)
            ?: quizRepository.save(Quiz(contentId = contentId, userId = userId))
        val questions = questionRepository.findByQuizId(quiz.id)
        return QuizWithQuestions(
            quizId    = quiz.id,
            lessonId  = contentId,
            questions = questions.map { q ->
                QuizQuestionDto(
                    questionId = q.id,
                    question   = q.question,
                    options    = mapOf("A" to q.optionA, "B" to q.optionB, "C" to q.optionC, "D" to q.optionD)
                )
            }
        )
    }

    fun scoreAnswer(quizId: Long, questionId: Long, selectedOption: String): AnswerResult {
        val question = questionRepository.findById(questionId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found") }
        return AnswerResult(
            correct       = question.correctOption.equals(selectedOption.trim(), ignoreCase = true),
            correctOption = question.correctOption,
            explanation   = question.explanation
        )
    }

    @Transactional
    fun submitQuiz(quizId: Long, userId: Long, submission: QuizSubmission): QuizResult {
        val quiz      = quizRepository.findById(quizId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz not found") }
        val questions = questionRepository.findByQuizId(quizId)
        val attempt   = attemptRepository.findByQuizIdAndUserId(quizId, userId)
        val score     = attempt?.score ?: 0.0

        val user     = userRepository.findById(userId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "User not found") }
        val existing = progressRepository.findByUserAndContentId(userId, quiz.contentId)
        val progress = (existing ?: LessonProgress(user = user, contentId = quiz.contentId)).copy(
            quizScore   = score,
            completed   = true,
            completedAt = LocalDateTime.now()
        )
        progressRepository.save(progress)
        log.info("Quiz {} submitted by userId={} score={}", quizId, userId, score)

        return QuizResult(quizId = quizId, score = score, totalQuestions = questions.size, feedback = emptyList())
    }
}

data class QuizWithQuestions(val quizId: Long, val lessonId: Long, val questions: List<QuizQuestionDto>)
fun QuizWithQuestions.toClientDto() = QuizDto(quizId = quizId, lessonId = lessonId, questions = questions)
fun Quiz.toClientDto() = QuizDto(quizId = id, lessonId = contentId, questions = emptyList())
'@

# ── FIX 13: Read AdaptiveUIService to understand the error ──
Write-Host "[13] Reading AdaptiveUIService.kt..."
$auPath = "$base\learner\AdaptiveUIService.kt"
if (Test-Path $auPath) {
    Get-Content $auPath
}

# ── FIX 14: Read LearnerDetailsService to see passwordHash error ─
Write-Host "[14] Reading LearnerDetailsService.kt..."
$ldPath = "$base\learner\LearnerDetailsService.kt"
if (Test-Path $ldPath) {
    Get-Content $ldPath
}

Write-Host "`nDone. Run: .\gradlew compileKotlin" -ForegroundColor Green
Write-Host "Paste any remaining errors back." -ForegroundColor Yellow

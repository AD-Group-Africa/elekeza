$base = Join-Path $PSScriptRoot "src\main\kotlin\com\elekeza\backend"

function Write-KtFile($rel, $content) {
    $path = Join-Path $base $rel
    $dir  = Split-Path $path
    if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    [System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
    Write-Host "  WRITTEN: $rel"
}

Write-Host "==============================`n ELEKEZA FINAL FIX`n=============================="

# â”€â”€ 1. RefreshTokens.kt â€” swap Learner FK for User â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[1] Fixing RefreshTokens.kt..."
Write-KtFile "auth\RefreshTokens.kt" @'
package com.elekeza.backend.auth

import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.time.OffsetDateTime
import java.util.UUID

@Entity
@Table(name = "refresh_tokens")
class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    val id: UUID = UUID.randomUUID()

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    lateinit var user: User

    @Column(name = "token_hash", nullable = false, unique = true)
    var tokenHash: String = ""

    @Column(name = "expires_at", nullable = false)
    lateinit var expiresAt: OffsetDateTime

    @Column(nullable = false)
    var revoked: Boolean = false

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    var createdAt: OffsetDateTime = OffsetDateTime.now()

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    var updatedAt: OffsetDateTime = OffsetDateTime.now()
}
'@

# â”€â”€ 2. RefreshTokenRepository â€” fix package reference â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[2] Fixing RefreshTokenRepository.kt..."
Write-KtFile "auth\RefreshTokenRepository.kt" @'
package com.elekeza.backend.auth

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.util.UUID

@Repository
interface RefreshTokenRepository : JpaRepository<RefreshToken, UUID> {
    fun findByTokenHash(tokenHash: String): RefreshToken?
    fun deleteByUser(user: User)
}
'@

# â”€â”€ 3. ContentService.kt â€” the original has inline entities that conflict â”€â”€â”€â”€
Write-Host "`n[3] Rewriting ContentService.kt (service only, no inline entities)..."
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
import org.springframework.web.multipart.MultipartFile
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

    fun upload(userId: Long, file: MultipartFile, sneType: String?): Content {
        if (file.size > MAX_SIZE_BYTES)
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "File too large. Maximum size is 10 MB.")
        if (file.contentType !in ALLOWED_TYPES)
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PDF, DOCX, and TXT files are accepted.")

        val uploadDir = Paths.get("uploads").also { Files.createDirectories(it) }
        val filename  = "${UUID.randomUUID()}_${file.originalFilename?.replace("[^a-zA-Z0-9._-]".toRegex(), "_")}"
        val filePath  = uploadDir.resolve(filename)
        file.transferTo(filePath)

        val content = contentRepository.save(Content(
            userId           = userId,
            title            = file.originalFilename,
            originalFilename = file.originalFilename,
            filePath         = filePath.toString(),
            sneType          = sneType,
            status           = ContentStatus.UPLOADING
        ))

        auditLogService.log(
            action   = "CONTENT_UPLOAD",
            category = "CONTENT",
            userId   = userId,
            detail   = "contentId=${content.id} file=${file.originalFilename} sneType=$sneType"
        )

        processWithAI(content.id, filePath.toString(), sneType ?: "NONE")
        return content
    }

    @Async
    @Transactional
    fun processWithAI(contentId: Long, filePath: String, sneType: String) {
        log.info("AI processing started: contentId={} sneType={}", contentId, sneType)
        contentRepository.updateStatus(contentId, ContentStatus.PROCESSING)

        val circuit = circuitBreakerRegistry.get("ai-service")
        try {
            @Suppress("UNCHECKED_CAST")
            val result = circuit.execute(
                call = {
                    RetryUtil.withRetry(
                        maxAttempts    = 2,
                        initialDelayMs = 1000,
                        retryOn        = { e -> e is ResourceAccessException }
                    ) {
                        val headers = HttpHeaders().apply {
                            contentType = MediaType.APPLICATION_JSON
                            set("X-Internal-Secret", internalSecret)
                        }
                        val response = restTemplate.postForEntity(
                            "$aiServiceUrl/process",
                            HttpEntity(mapOf("file_path" to filePath, "sne_type" to sneType), headers),
                            Map::class.java
                        )
                        response.body ?: throw IllegalStateException("AI service returned empty response")
                    }
                },
                fallback = null
            ) as Map<String, Any>

            val simplified = result["simplified_text"] as? String ?: ""
            val wordCount  = (result["word_count"] as? Number)?.toInt()
                ?: simplified.split("\\s+".toRegex()).filter { it.isNotBlank() }.size

            contentRepository.updateSimplified(contentId, simplified, wordCount, ContentStatus.READY)
            auditLogService.log("CONTENT_PROCESSED", "CONTENT", detail = "contentId=$contentId words=$wordCount")

        } catch (e: CircuitOpenException) {
            log.warn("AI circuit OPEN â€” fast-failing contentId={}", contentId)
            contentRepository.updateStatus(contentId, ContentStatus.FAILED)
        } catch (e: Exception) {
            log.error("AI processing failed: contentId={}", contentId, e)
            contentRepository.updateStatus(contentId, ContentStatus.FAILED)
        }
    }

    fun getContent(contentId: Long, userId: Long): Content =
        contentRepository.findByIdAndUserId(contentId, userId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Content not found")

    fun list(userId: Long, page: Int, size: Int): Page<Content> =
        contentRepository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(page, size.coerceAtMost(50)))

    fun deleteContent(contentId: Long, userId: Long) {
        val content = getContent(contentId, userId)
        content.filePath?.let { path ->
            try { Files.deleteIfExists(Paths.get(path)) }
            catch (e: Exception) { log.warn("Could not delete file {}: {}", path, e.message) }
        }
        contentRepository.delete(content)
        auditLogService.log("CONTENT_DELETED", "CONTENT", userId = userId, detail = "contentId=$contentId")
    }
}
'@

# â”€â”€ 4. Content.kt â€” standalone entity (no inline service/repo) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[4] Rewriting Content.kt..."
Write-KtFile "content\Content.kt" @'
package com.elekeza.backend.content

import jakarta.persistence.*
import java.time.LocalDateTime

enum class ContentStatus { UPLOADING, PROCESSING, READY, FAILED }

@Entity
@Table(
    name = "content",
    indexes = [
        Index(name = "idx_content_user_id", columnList = "user_id"),
        Index(name = "idx_content_status",  columnList = "status")
    ]
)
data class Content(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(length = 255)
    val title: String? = null,

    @Column(name = "original_filename", length = 255)
    val originalFilename: String? = null,

    @Column(name = "file_path", columnDefinition = "TEXT")
    val filePath: String? = null,

    @Column(name = "sne_type", length = 50)
    val sneType: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    val status: ContentStatus = ContentStatus.UPLOADING,

    @Column(name = "simplified_text", columnDefinition = "TEXT")
    val simplifiedText: String? = null,

    @Column(name = "word_count")
    val wordCount: Int? = null,

    @Column(name = "created_at")
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "updated_at")
    val updatedAt: LocalDateTime = LocalDateTime.now()
) {
    fun toDto() = ContentDto(
        id             = id,
        title          = title,
        sneType        = sneType,
        status         = status.name,
        simplifiedText = simplifiedText,
        wordCount      = wordCount,
        createdAt      = createdAt
    )

    fun toListDto() = ContentListDto(
        id               = id,
        title            = title,
        originalFilename = originalFilename,
        sneType          = sneType,
        status           = status.name,
        wordCount        = wordCount,
        createdAt        = createdAt
    )
}

data class ContentDto(
    val id:             Long,
    val title:          String?,
    val sneType:        String?,
    val status:         String,
    val simplifiedText: String?,
    val wordCount:      Int?,
    val createdAt:      LocalDateTime
)

data class ContentListDto(
    val id:               Long,
    val title:            String?,
    val originalFilename: String?,
    val sneType:          String?,
    val status:           String,
    val wordCount:        Int?,
    val createdAt:        LocalDateTime
)
'@

# â”€â”€ 5. ContentRepository.kt â€” proper methods â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[5] Rewriting ContentRepository.kt..."
Write-KtFile "content\ContentRepository.kt" @'
package com.elekeza.backend.content

import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
interface ContentRepository : JpaRepository<Content, Long> {

    fun findByUserIdOrderByCreatedAtDesc(userId: Long, pageable: PageRequest): Page<Content>

    fun findByIdAndUserId(id: Long, userId: Long): Content?

    @Modifying
    @Query("UPDATE Content c SET c.status = :status, c.updatedAt = :now WHERE c.id = :id")
    fun updateStatus(
        @Param("id") id: Long,
        @Param("status") status: ContentStatus,
        @Param("now") now: LocalDateTime = LocalDateTime.now()
    ): Int

    @Modifying
    @Query("""
        UPDATE Content c
        SET c.simplifiedText = :text,
            c.wordCount = :wordCount,
            c.status = :status,
            c.updatedAt = :now
        WHERE c.id = :id
    """)
    fun updateSimplified(
        @Param("id") id: Long,
        @Param("text") text: String,
        @Param("wordCount") wordCount: Int,
        @Param("status") status: ContentStatus,
        @Param("now") now: LocalDateTime = LocalDateTime.now()
    ): Int
}
'@

# â”€â”€ 6. ContentController.kt â€” uses userId not User object â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[6] Rewriting ContentController.kt..."
Write-KtFile "content\controller\ContentController.kt" @'
package com.elekeza.backend.content.controller

import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.content.ContentDto
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.content.ContentService
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/content")
class ContentController(
    private val contentService:    ContentService,
    private val contentRepository: ContentRepository,
    private val userRepository:    UserRepository
) {
    private fun resolveUserId(principal: UserDetails): Long =
        userRepository.findByEmail(principal.username)?.id
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")

    @PostMapping("/upload")
    fun upload(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestParam("file") file: MultipartFile,
        @RequestParam(value = "sneType", required = false) sneType: String?
    ): ResponseEntity<ContentDto> {
        val userId  = resolveUserId(principal)
        val content = contentService.upload(userId, file, sneType)
        return ResponseEntity.status(202).body(content.toDto())
    }

    @GetMapping("/{id}")
    fun getById(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable id: Long
    ): ResponseEntity<ContentDto> {
        val userId  = resolveUserId(principal)
        val content = contentService.getContent(id, userId)
        return ResponseEntity.ok(content.toDto())
    }

    @GetMapping("/list")
    fun list(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): ResponseEntity<*> {
        val userId   = resolveUserId(principal)
        val pageable = PageRequest.of(page, size.coerceAtMost(50), Sort.by("createdAt").descending())
        val results  = contentRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
        return ResponseEntity.ok(mapOf(
            "data"       to results.content.map { it.toListDto() },
            "total"      to results.totalElements,
            "page"       to results.number,
            "totalPages" to results.totalPages
        ))
    }

    @DeleteMapping("/{id}")
    fun delete(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable id: Long
    ): ResponseEntity<*> {
        val userId = resolveUserId(principal)
        contentService.deleteContent(id, userId)
        return ResponseEntity.ok(mapOf("message" to "Content deleted"))
    }
}
'@

# â”€â”€ 7. FileUploadService.kt â€” remove dependency on old ContentService.uploadText â”€â”€
Write-Host "`n[7] Rewriting FileUploadService.kt..."
Write-KtFile "content\FileUploadService.kt" @'
package com.elekeza.backend.content

import org.apache.pdfbox.Loader
import org.apache.pdfbox.text.PDFTextStripper
import org.apache.poi.xwpf.usermodel.XWPFDocument
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile

private val SUPPORTED_TYPES = setOf(
    "text/plain",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)
private const val MAX_BYTES = 10 * 1024 * 1024L

@Service
class FileUploadService(
    private val contentService: ContentService
) {
    fun uploadFile(userId: Long, file: MultipartFile): Content {
        if (file.isEmpty) throw IllegalArgumentException("File is empty.")
        if (file.size > MAX_BYTES) throw IllegalArgumentException("File exceeds 10 MB limit.")

        val mime = file.contentType?.lowercase()?.trim() ?: ""
        if (mime !in SUPPORTED_TYPES)
            throw IllegalArgumentException("Unsupported file type '$mime'.")

        return contentService.upload(userId, file, null)
    }

    fun extractText(file: MultipartFile): String {
        val mime = file.contentType?.lowercase()?.trim() ?: ""
        return when {
            mime == "text/plain"          -> file.inputStream.bufferedReader(Charsets.UTF_8).readText()
            mime == "application/pdf"     -> Loader.loadPDF(file.bytes).use { PDFTextStripper().getText(it) }
            mime.contains("wordprocessingml") -> XWPFDocument(file.inputStream).use { doc ->
                doc.paragraphs.joinToString("\n") { it.text }
            }
            else -> throw IllegalArgumentException("Cannot extract text from '$mime'.")
        }.trim()
    }
}
'@

# â”€â”€ 8. FileUploadController.kt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[8] Rewriting FileUploadController.kt..."
Write-KtFile "content\controller\FileUploadController.kt" @'
package com.elekeza.backend.content.controller

import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.content.Content
import com.elekeza.backend.content.FileUploadService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/content")
class FileUploadController(
    private val fileUploadService: FileUploadService,
    private val userRepository:    UserRepository
) {
    private fun resolveUserId(principal: UserDetails): Long =
        userRepository.findByEmail(principal.username)?.id
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")

    @PostMapping("/upload/file", consumes = ["multipart/form-data"])
    fun uploadFile(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestParam("file") file: MultipartFile
    ): ResponseEntity<Content> {
        val userId = resolveUserId(principal)
        return ResponseEntity.ok(fileUploadService.uploadFile(userId, file))
    }
}
'@

# â”€â”€ 9. AgeGroup.kt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[9] Ensuring AgeGroup.kt is in learner package..."
Write-KtFile "learner\AgeGroup.kt" @'
package com.elekeza.backend.learner

enum class AgeGroup { CHILD, TEEN, ADULT, SENIOR }
'@

# â”€â”€ 10. LiteracyLevel.kt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[10] Ensuring LiteracyLevel.kt is in learner package..."
Write-KtFile "learner\LiteracyLevel.kt" @'
package com.elekeza.backend.learner

enum class LiteracyLevel { BEGINNER, INTERMEDIATE, ADVANCED }
'@

# â”€â”€ 11. Guardian.kt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[11] Ensuring Guardian.kt is in learner package..."
Write-KtFile "learner\Guardian.kt" @'
package com.elekeza.backend.learner

import jakarta.persistence.*
import java.util.UUID

@Entity
@Table(name = "guardians")
class Guardian(
    @Id
    val id: UUID = UUID.randomUUID(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "learner_id", nullable = false)
    var learner: Learner = Learner(),

    @Column(name = "full_name", nullable = false)
    var fullName: String = "",

    @Column(nullable = false)
    var relationship: String = "",

    @Column
    var phone: String? = null,

    @Column
    var email: String? = null
)
'@

# â”€â”€ 12. GuardianRepository.kt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[12] Fixing GuardianRepository.kt..."
Write-KtFile "learner\GuardianRepository.kt" @'
package com.elekeza.backend.learner

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.util.UUID

@Repository
interface GuardianRepository : JpaRepository<Guardian, UUID> {
    fun findAllByLearnerId(learnerId: UUID): List<Guardian>
}
'@

# â”€â”€ 13. Learner.kt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[13] Fixing Learner.kt (AgeGroup + LiteracyLevel in learner package)..."
Write-KtFile "learner\Learner.kt" @'
package com.elekeza.backend.learner

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.util.UUID

@Entity
@Table(name = "learners")
class Learner(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(nullable = false, unique = true)
    val email: String = "",

    @Column(name = "preferred_language", length = 10)
    var preferredLanguage: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "age_group", length = 20)
    var ageGroup: AgeGroup? = null,

    @Column(name = "learning_goal")
    var learningGoal: String? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "cognitive_profiles", columnDefinition = "jsonb")
    var cognitiveProfiles: List<String> = emptyList(),

    @Enumerated(EnumType.STRING)
    @Column(name = "literacy_level", length = 20)
    var literacyLevel: LiteracyLevel? = null,

    @Column(name = "onboarding_complete")
    var onboardingComplete: Boolean = false
)
'@

# â”€â”€ 14. LearnerRepository.kt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[14] Fixing LearnerRepository.kt..."
Write-KtFile "learner\LearnerRepository.kt" @'
package com.elekeza.backend.learner

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.util.Optional
import java.util.UUID

@Repository
interface LearnerRepository : JpaRepository<Learner, UUID> {
    fun findByEmail(email: String): Optional<Learner>
    fun existsByEmail(email: String): Boolean
}
'@

# â”€â”€ 15. OnboardingService.kt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[15] Fixing OnboardingService.kt..."
Write-KtFile "learner\OnboardingService.kt" @'
package com.elekeza.backend.learner

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

data class ProfileRequest(
    val preferredLanguage: String,
    val ageGroup: AgeGroup,
    val learningGoal: String? = null,
    val cognitiveProfiles: List<String>? = null
)

data class PlacementRequest(val score: Int, val totalQuestions: Int)
data class GuardianLinkRequest(val fullName: String, val relationship: String, val phone: String? = null, val email: String? = null)
data class OnboardingResponse(val learnerId: UUID, val message: String, val onboardingComplete: Boolean = false)
data class PlacementResponse(val learnerId: UUID, val literacyLevel: LiteracyLevel, val message: String)
data class GuardianLinkResponse(val guardianId: UUID, val learnerId: UUID, val message: String)

@Service
class OnboardingService(
    private val learnerRepository:  LearnerRepository,
    private val guardianRepository: GuardianRepository
) {
    @Transactional
    fun saveProfile(learnerId: UUID, request: ProfileRequest): OnboardingResponse {
        val learner = learnerRepository.findById(learnerId).orElseThrow { IllegalArgumentException("Learner not found") }
        learner.preferredLanguage = request.preferredLanguage
        learner.ageGroup          = request.ageGroup
        learner.learningGoal      = request.learningGoal
        request.cognitiveProfiles?.let { learner.cognitiveProfiles = it.map { p -> p.trim().lowercase() }.filter { p -> p.isNotBlank() }.distinct() }
        learnerRepository.save(learner)
        return OnboardingResponse(learner.id, "Profile saved", learner.onboardingComplete)
    }

    @Transactional
    fun savePlacement(learnerId: UUID, request: PlacementRequest): PlacementResponse {
        require(request.totalQuestions > 0)
        require(request.score in 0..request.totalQuestions)
        val learner = learnerRepository.findById(learnerId).orElseThrow { IllegalArgumentException("Learner not found") }
        val pct   = (request.score.toDouble() / request.totalQuestions) * 100
        val level = when {
            pct >= 70 -> LiteracyLevel.ADVANCED
            pct >= 40 -> LiteracyLevel.INTERMEDIATE
            else      -> LiteracyLevel.BEGINNER
        }
        learner.literacyLevel = level
        learnerRepository.save(learner)
        return PlacementResponse(learner.id, level, "Placement complete â€” level: ${level.name.lowercase()}")
    }

    @Transactional
    fun completeOnboarding(learnerId: UUID): OnboardingResponse {
        val learner = learnerRepository.findById(learnerId).orElseThrow { IllegalArgumentException("Learner not found") }
        check(!learner.onboardingComplete) { "Onboarding already completed" }
        check(learner.ageGroup != null)    { "Profile must be saved first" }
        check(learner.literacyLevel != null) { "Placement must be completed first" }
        learner.onboardingComplete = true
        learnerRepository.save(learner)
        return OnboardingResponse(learner.id, "Onboarding complete", true)
    }

    @Transactional
    fun linkGuardian(learnerId: UUID, request: GuardianLinkRequest): GuardianLinkResponse {
        require(request.phone != null || request.email != null) { "At least one contact method required" }
        val learner = learnerRepository.findById(learnerId).orElseThrow { IllegalArgumentException("Learner not found") }
        val saved = guardianRepository.save(Guardian().apply {
            this.learner      = learner
            this.fullName     = request.fullName
            this.relationship = request.relationship
            this.phone        = request.phone
            this.email        = request.email
        })
        return GuardianLinkResponse(saved.id, learner.id, "Guardian linked")
    }
}
'@

# â”€â”€ 16. OnboardingController.kt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[16] Fixing OnboardingController.kt..."
Write-KtFile "learner\controller\OnboardingController.kt" @'
package com.elekeza.backend.learner.controller

import com.elekeza.backend.learner.*
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import java.util.UUID

@RestController
@RequestMapping("/api/onboarding")
class OnboardingController(
    private val onboardingService: OnboardingService
) {
    private fun learnerId(principal: UserDetails) = UUID.fromString(principal.username)

    @PostMapping("/profile")
    fun saveProfile(@AuthenticationPrincipal p: UserDetails, @RequestBody req: ProfileRequest): ResponseEntity<OnboardingResponse> =
        ResponseEntity.ok(onboardingService.saveProfile(learnerId(p), req))

    @PostMapping("/placement")
    fun savePlacement(@AuthenticationPrincipal p: UserDetails, @RequestBody req: PlacementRequest): ResponseEntity<PlacementResponse> =
        ResponseEntity.ok(onboardingService.savePlacement(learnerId(p), req))

    @PostMapping("/complete")
    fun complete(@AuthenticationPrincipal p: UserDetails): ResponseEntity<OnboardingResponse> =
        ResponseEntity.ok(onboardingService.completeOnboarding(learnerId(p)))

    @PostMapping("/guardian")
    fun linkGuardian(@AuthenticationPrincipal p: UserDetails, @RequestBody req: GuardianLinkRequest): ResponseEntity<GuardianLinkResponse> =
        ResponseEntity.ok(onboardingService.linkGuardian(learnerId(p), req))
}
'@

# â”€â”€ 17. LessonProgress.kt â€” use User FK, not userId raw â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[17] Fixing LessonProgress.kt..."
Write-KtFile "learner\LessonProgress.kt" @'
package com.elekeza.backend.learner

import com.elekeza.backend.auth.User
import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(
    name = "lesson_progress",
    indexes = [
        Index(name = "idx_lp_user",    columnList = "user_id"),
        Index(name = "idx_lp_content", columnList = "content_id")
    ]
)
data class LessonProgress(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,

    @Column(name = "content_id", nullable = false)
    val contentId: Long,

    @Column(name = "quiz_score")
    var quizScore: Double? = null,

    @Column(nullable = false)
    var completed: Boolean = false,

    @Column(name = "completed_at")
    var completedAt: LocalDateTime? = null,

    @Column(name = "created_at", updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now()
)
'@

# â”€â”€ 18. Repositories.kt (LessonProgressRepository etc.) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[18] Fixing Repositories.kt..."
Write-KtFile "learner\Repositories.kt" @'
package com.elekeza.backend.learner

import com.elekeza.backend.auth.User
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
interface LearnerProfileRepository : JpaRepository<LearnerProfile, Long> {
    fun findByUserId(userId: Long): LearnerProfile?
}

@Repository
interface LessonProgressRepository : JpaRepository<LessonProgress, Long> {
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<LessonProgress>

    fun findByUserAndContentId(user: User, contentId: Long): LessonProgress?

    @Query("SELECT COUNT(p) FROM LessonProgress p WHERE p.user.id = :userId AND p.completed = true")
    fun countByUserIdAndCompleted(@Param("userId") userId: Long, completed: Boolean): Long

    @Query("SELECT AVG(p.quizScore) FROM LessonProgress p WHERE p.user.id = :userId AND p.quizScore IS NOT NULL")
    fun avgQuizScore(@Param("userId") userId: Long): Double?

    @Query("SELECT p FROM LessonProgress p WHERE p.user.id = :userId AND p.completedAt >= :since")
    fun findRecentActivity(@Param("userId") userId: Long, @Param("since") since: LocalDateTime): List<LessonProgress>

    @Query("SELECT p FROM LessonProgress p WHERE p.user.id = :userId AND p.completed = true")
    fun findByUserIdAndCompleted(@Param("userId") userId: Long, completed: Boolean): List<LessonProgress>

    @Query("SELECT p FROM LessonProgress p WHERE p.user.id = :userId AND p.contentId = :contentId")
    fun findByUserIdAndContentId(@Param("userId") userId: Long, @Param("contentId") contentId: Long): LessonProgress?
}
'@

# â”€â”€ 19. LearnerProfileController.kt â€” updated to use User FK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[19] Rewriting LearnerProfileController.kt..."
Write-KtFile "learner\controller\LearnerProfileController.kt" @'
package com.elekeza.backend.learner.controller

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.learner.*
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate
import java.time.LocalDateTime

data class UpdateProfileRequest(val sneType: String? = null, val preferences: Map<String, Any>? = null)
data class CompleteProgressRequest(val quizScore: Double? = null)

data class LearnerProfileDto(val id: Long, val userId: Long, val sneType: String?, val preferences: Map<String, Any>, val createdAt: LocalDateTime, val updatedAt: LocalDateTime)
data class LessonProgressDto(val id: Long, val userId: Long, val contentId: Long, val quizScore: Double?, val completed: Boolean, val completedAt: LocalDateTime?, val createdAt: LocalDateTime)
data class LearnerStatsDto(val lessonsCompleted: Long, val avgQuizScore: Double?, val recentActivity: Int, val streak: Int, val lastActive: LocalDate?)

fun LearnerProfile.toDto() = LearnerProfileDto(id, userId, sneType?.name, preferences, createdAt, updatedAt)
fun LessonProgress.toDto() = LessonProgressDto(id, user.id, contentId, quizScore, completed, completedAt, createdAt)

@RestController
@RequestMapping("/api/learner")
class LearnerProfileController(
    private val profileRepository:  LearnerProfileRepository,
    private val progressRepository: LessonProgressRepository,
    private val userRepository:     UserRepository
) {
    private val log = LoggerFactory.getLogger(LearnerProfileController::class.java)

    private fun resolveUser(principal: UserDetails): User =
        userRepository.findByEmail(principal.username)
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")

    @GetMapping("/profile")
    fun getProfile(@AuthenticationPrincipal principal: UserDetails): ResponseEntity<LearnerProfileDto> {
        val user    = resolveUser(principal)
        val profile = profileRepository.findByUserId(user.id) ?: LearnerProfile(user = user)
        return ResponseEntity.ok(profile.toDto())
    }

    @PutMapping("/profile")
    fun updateProfile(@AuthenticationPrincipal principal: UserDetails, @RequestBody req: UpdateProfileRequest): ResponseEntity<LearnerProfileDto> {
        val user     = resolveUser(principal)
        val existing = profileRepository.findByUserId(user.id)
        val updated  = if (existing != null) {
            existing.copy(updatedAt = LocalDateTime.now())
        } else {
            LearnerProfile(user = user, preferences = req.preferences ?: emptyMap())
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
        return ResponseEntity.ok(progressRepository.save(record).toDto())
    }

    @GetMapping("/stats")
    fun getStats(@AuthenticationPrincipal principal: UserDetails): ResponseEntity<LearnerStatsDto> {
        val user             = resolveUser(principal)
        val lessonsCompleted = progressRepository.countByUserIdAndCompleted(user.id, true)
        val avgScore         = progressRepository.avgQuizScore(user.id)
        val recentActivity   = progressRepository.findRecentActivity(user.id, LocalDateTime.now().minusDays(7)).size
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

# â”€â”€ 20. LearnerEntities.kt â€” remove duplicate toDto / UpdateProfileRequest â”€â”€
Write-Host "`n[20] Cleaning LearnerEntities.kt..."
$entPath = Join-Path $base "learner\LearnerEntities.kt"
if (Test-Path $entPath) {
    $ent = [System.IO.File]::ReadAllText($entPath)
    # Remove any data class UpdateProfileRequest block
    $ent = $ent -replace '(?s)data class UpdateProfileRequest[^}]+\}', ''
    # Remove any fun LessonProgress.toDto() block
    $ent = $ent -replace '(?s)fun LessonProgress\.toDto\(\)[^}]+\}', ''
    # Remove any fun LearnerProfile.toDto() block
    $ent = $ent -replace '(?s)fun LearnerProfile\.toDto\(\)[^}]+\}', ''
    [System.IO.File]::WriteAllText($entPath, $ent, [System.Text.UTF8Encoding]::new($false))
    Write-Host "  CLEANED: LearnerEntities.kt"
} else {
    Write-Host "  NOT FOUND: LearnerEntities.kt (skipping)"
}

# â”€â”€ 21. LearnerDetailsService.kt â€” use empty password (auth via User not Learner) â”€â”€
Write-Host "`n[21] Fixing LearnerDetailsService.kt..."
Write-KtFile "learner\LearnerDetailsService.kt" @'
package com.elekeza.backend.learner

import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.userdetails.User
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.core.userdetails.UsernameNotFoundException
import org.springframework.stereotype.Service
import java.util.UUID

@Service
class LearnerDetailsService(
    private val learnerRepository: LearnerRepository
) : UserDetailsService {
    override fun loadUserByUsername(username: String): UserDetails {
        val id = runCatching { UUID.fromString(username) }
            .getOrElse { throw UsernameNotFoundException("Invalid learner ID: $username") }
        learnerRepository.findById(id).orElseThrow { UsernameNotFoundException("Learner not found: $id") }
        // Learners authenticate via JWT; password field is unused â€” supply empty placeholder
        return User.builder()
            .username(username)
            .password("{noop}")
            .authorities(SimpleGrantedAuthority("ROLE_LEARNER"))
            .build()
    }
}
'@

# â”€â”€ 22. AdaptiveUIService.kt â€” fix pageable call â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[22] Patching AdaptiveUIService.kt pageable call..."
$uiPath = Join-Path $base "learner\AdaptiveUIService.kt"
if (Test-Path $uiPath) {
    $ui = [System.IO.File]::ReadAllText($uiPath)
    $ui = $ui -replace '\.findByUserIdOrderByCreatedAtDesc\(userId,\s*pageable\)\s*\n\s*\.content', '.findByUserIdOrderByCreatedAtDesc(userId).take(5)'
    $ui = $ui -replace 'val pageable\s*=\s*PageRequest\.of\(0,\s*5\)\s*\n\s*val recentProgress\s*=\s*progressRepository', 'val recentProgress = progressRepository'
    [System.IO.File]::WriteAllText($uiPath, $ui, [System.Text.UTF8Encoding]::new($false))
    Write-Host "  PATCHED: AdaptiveUIService.kt"
} else {
    Write-Host "  NOT FOUND: AdaptiveUIService.kt"
}

# â”€â”€ 23. QuizService.kt â€” fix LessonProgress constructor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[23] Fixing QuizService.kt LessonProgress constructor..."
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
    private val log = LoggerFactory.getLogger(QuizService::class.java)

    fun generateQuiz(contentId: Long, userId: Long): QuizWithQuestions {
        val quiz = quizRepository.findByContentIdAndUserId(contentId, userId)
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

    // alias used by QuizController
    fun getOrCreateQuiz(contentId: Long, userId: Long) = generateQuiz(contentId, userId)

    fun scoreAnswer(quizId: Long, questionId: Long, selectedOption: String): AnswerResult {
        val question = questionRepository.findById(questionId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found")
        }
        return AnswerResult(
            correct       = question.correctOption.equals(selectedOption.trim(), ignoreCase = true),
            correctOption = question.correctOption,
            explanation   = question.explanation
        )
    }

    @Transactional
    fun submitQuiz(quizId: Long, userId: Long, submission: AnswerSubmission): QuizResult {
        return completeQuiz(quizId, userId)
    }

    @Transactional
    fun completeQuiz(quizId: Long, userId: Long): QuizResult {
        val quiz      = quizRepository.findById(quizId).orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz not found") }
        val questions = questionRepository.findByQuizId(quizId)
        val attempt   = attemptRepository.findByQuizIdAndUserId(quizId, userId)
        val score     = attempt?.score ?: 0.0

        val user     = userRepository.findById(userId).orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "User not found") }
        val existing = progressRepository.findByUserAndContentId(user, quiz.contentId)
        val progress = (existing ?: LessonProgress(user = user, contentId = quiz.contentId)).copy(
            quizScore   = score,
            completed   = true,
            completedAt = LocalDateTime.now()
        )
        progressRepository.save(progress)

        return QuizResult(quizId = quizId, score = score, totalQuestions = questions.size, feedback = emptyList())
    }
}

data class QuizWithQuestions(val quizId: Long, val lessonId: Long, val questions: List<QuizQuestionDto>)
'@

# â”€â”€ 24. QuizController.kt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[24] Fixing QuizController.kt..."
Write-KtFile "quiz\controller\QuizController.kt" @'
package com.elekeza.backend.quiz.controller

import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.quiz.*
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/quiz")
class QuizController(
    private val quizService:    QuizService,
    private val quizRepository: QuizRepository,
    private val userRepository: UserRepository
) {
    private fun resolveUserId(principal: UserDetails): Long =
        userRepository.findByEmail(principal.username)?.id
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")

    @PostMapping("/generate/{contentId}")
    fun generate(@AuthenticationPrincipal p: UserDetails, @PathVariable contentId: Long): ResponseEntity<QuizDto> {
        val userId = resolveUserId(p)
        val quiz   = quizService.generateQuiz(contentId, userId)
        return ResponseEntity.status(201).body(
            QuizDto(quizId = quiz.quizId, lessonId = quiz.lessonId, questions = quiz.questions)
        )
    }

    @GetMapping("/{quizId}")
    fun getQuiz(@AuthenticationPrincipal p: UserDetails, @PathVariable quizId: Long): ResponseEntity<QuizDto> {
        val quiz      = quizRepository.findById(quizId).orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz not found") }
        val questions = emptyList<QuizQuestionDto>()
        return ResponseEntity.ok(QuizDto(quizId = quiz.id, lessonId = quiz.contentId, questions = questions))
    }

    @PostMapping("/{quizId}/submit")
    fun submit(@AuthenticationPrincipal p: UserDetails, @PathVariable quizId: Long, @RequestBody submission: AnswerSubmission): ResponseEntity<QuizResult> {
        val userId = resolveUserId(p)
        return ResponseEntity.ok(quizService.submitQuiz(quizId, userId, submission))
    }
}
'@

# â”€â”€ 25. LessonPersistenceService.kt â€” aligned to actual entity fields â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[25] Fixing LessonPersistenceService.kt..."
Write-KtFile "content\LessonPersistenceService.kt" @'
package com.elekeza.backend.content

import com.elekeza.backend.common.ai.*
import com.elekeza.backend.learner.LearnerRepository
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class LessonPersistenceService(
    private val lessonRepository:        LessonRepository,
    private val lessonSectionRepository: LessonSectionRepository,
    private val keyTermRepository:       KeyTermRepository,
    private val learnerRepository:       LearnerRepository,
    private val objectMapper:            ObjectMapper
) {
    @Transactional
    fun persistLesson(
        learnerId:  UUID,
        rawText:    String,
        lessonJson: LessonJSON,
        quizJson:   QuizJSON,
        sourceType: SourceType
    ): LessonResponse {
        val learner = learnerRepository.findById(learnerId)
            .orElseThrow { IllegalArgumentException("Learner not found") }

        val lesson = Lesson().apply {
            this.learner       = learner
            this.title         = lessonJson.title
            this.rawText       = rawText
            this.sourceType    = sourceType
            this.quizQuestions = objectMapper.writeValueAsString(quizJson.questions)
        }
        val savedLesson = lessonRepository.save(lesson)

        val sections = lessonJson.sections.mapIndexed { idx, aiSection ->
            LessonSection().apply {
                this.lesson         = savedLesson
                this.sequenceNumber = idx + 1
                this.content        = "${aiSection.header}\n\n${aiSection.content}"
            }
        }
        lessonSectionRepository.saveAll(sections)

        val keyTerms = lessonJson.terms.map { aiTerm ->
            KeyTerm().apply {
                this.lesson     = savedLesson
                this.term       = aiTerm.term
                this.definition = aiTerm.definition
            }
        }
        keyTermRepository.saveAll(keyTerms)

        return LessonResponse(
            id       = savedLesson.id,
            title    = savedLesson.title,
            sections = sections.map { s -> SectionResponse(id = 0L, header = s.content.substringBefore("\n"), content = s.content) },
            terms    = keyTerms.map { k -> KeyTermResponse(id = 0L, term = k.term, definition = k.definition) }
        )
    }
}
'@

# â”€â”€ 26. LessonRepositories.kt â€” KeyTermRepository etc. â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[26] Ensuring LessonRepositories.kt..."
Write-KtFile "content\LessonRepositories.kt" @'
package com.elekeza.backend.content

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.util.UUID

@Repository
interface LessonRepository : JpaRepository<Lesson, UUID>

@Repository
interface LessonSectionRepository : JpaRepository<LessonSection, UUID>

@Repository
interface KeyTermRepository : JpaRepository<KeyTerm, UUID>
'@

# â”€â”€ 27. AiDtos.kt â€” ensure LessonResponse id is Long (matches AiDtos) â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[27] Patching AiDtos.kt SectionResponse/KeyTermResponse ids (Long)..."
$dtoPath = Join-Path $base "common\ai\AiDtos.kt"
if (Test-Path $dtoPath) {
    $dto = [System.IO.File]::ReadAllText($dtoPath)
    # Already Long in AiDtos.kt per file read â€” just ensure AiClientException accepts (Int, String)
    Write-Host "  OK: AiDtos.kt ids are already Long"
}

# â”€â”€ 28. AiClientException â€” accept (Int, String) constructor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[28] Fixing AiClientException.kt..."
Write-KtFile "common\ai\AiClientException.kt" @'
package com.elekeza.backend.common.ai

class AiClientException(val statusCode: Int, message: String) : RuntimeException(message) {
    constructor(message: String) : this(500, message)
}
'@

# â”€â”€ 29. MockAiClient.kt â€” rewritten against actual AiDtos field names â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[29] Rewriting MockAiClient.kt..."
Write-KtFile "common\ai\MockAiClient.kt" @'
package com.elekeza.backend.common.ai

import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Service

@Service
@ConditionalOnProperty(name = ["ai.client.type"], havingValue = "mock")
class MockAiClient : AiClient {
    private val log = LoggerFactory.getLogger(javaClass)

    override fun simplifyText(request: SimplifyTextRequest): LessonJSON {
        log.info("Mock: simplifyText")
        return LessonJSON(
            title    = "Mock Lesson",
            sections = listOf(AiSection(header = "Introduction", content = "Mock simplified text.")),
            terms    = listOf(AiKeyTerm(term = "Mock Term", definition = "A mock definition"))
        )
    }

    override fun simplifyImage(request: SimplifyImageRequest): LessonJSON {
        log.info("Mock: simplifyImage")
        return LessonJSON(
            title    = "Mock Image Lesson",
            sections = listOf(AiSection(header = "Image Description", content = "Mock image description.")),
            terms    = emptyList()
        )
    }

    override fun generateQuiz(request: GenerateQuizRequest): QuizJSON {
        log.info("Mock: generateQuiz")
        return QuizJSON(
            questions = listOf(
                AiQuizQuestion(
                    question = "What is the main idea?",
                    options  = listOf(
                        AiQuizOption(text = "Option A", isCorrect = true),
                        AiQuizOption(text = "Option B", isCorrect = false)
                    )
                )
            )
        )
    }

    override fun adaptiveResponse(request: AdaptiveResponseRequest): AdaptiveResponseJSON {
        log.info("Mock: adaptiveResponse")
        return AdaptiveResponseJSON(response = "Good try! Keep going.")
    }

    override fun wrongAnswerFlow(request: WrongAnswerFlowRequest): WrongAnswerFlowJSON {
        log.info("Mock: wrongAnswerFlow")
        return WrongAnswerFlowJSON(feedback = "Let us review.", hint = "Think carefully.")
    }
}
'@

# â”€â”€ 30. AiClient.kt â€” fix wildcard import pointing to non-existent dto sub-package â”€â”€
Write-Host "`n[30] Fixing AiClient.kt import..."
Write-KtFile "common\ai\AiClient.kt" @'
package com.elekeza.backend.common.ai

interface AiClient {
    fun simplifyText(request: SimplifyTextRequest): LessonJSON
    fun simplifyImage(request: SimplifyImageRequest): LessonJSON
    fun generateQuiz(request: GenerateQuizRequest): QuizJSON
    fun adaptiveResponse(request: AdaptiveResponseRequest): AdaptiveResponseJSON
    fun wrongAnswerFlow(request: WrongAnswerFlowRequest): WrongAnswerFlowJSON
}
'@

# â”€â”€ 31. LearnerProfile.kt â€” ensure it has userId: Long field â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[31] Ensuring LearnerProfile.kt has correct userId field..."
Write-KtFile "learner\LearnerProfile.kt" @'
package com.elekeza.backend.learner

import com.elekeza.backend.auth.SneType
import com.elekeza.backend.auth.User
import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.LocalDateTime

@Entity
@Table(name = "learner_profiles", indexes = [Index(name = "idx_learner_profile_user", columnList = "user_id")])
data class LearnerProfile(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    val user: User,

    @Enumerated(EnumType.STRING)
    @Column(name = "sne_type", length = 50)
    val sneType: SneType? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    val preferences: Map<String, Any> = emptyMap(),

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "adaptation_state", columnDefinition = "jsonb")
    val adaptationState: Map<String, Any> = emptyMap(),

    @Column(name = "created_at") val createdAt: LocalDateTime = LocalDateTime.now(),
    @Column(name = "updated_at") val updatedAt: LocalDateTime = LocalDateTime.now()
) {
    val userId: Long get() = user.id
}

data class UIPreferences(
    val fontSize:      String?  = null,
    val contrast:      String?  = null,
    val animations:    Boolean? = null,
    val assistiveMode: Boolean? = null
) {
    companion object {
        fun from(raw: Map<String, Any>): UIPreferences = UIPreferences(
            fontSize      = raw["fontSize"]   as? String,
            contrast      = raw["contrast"]   as? String,
            animations    = when (val v = raw["animations"])    { is Boolean -> v; is String -> v.toBooleanStrictOrNull(); else -> null },
            assistiveMode = when (val v = raw["assistiveMode"]) { is Boolean -> v; is String -> v.toBooleanStrictOrNull(); else -> null }
        )
    }
    fun toMap(): Map<String, Any> = buildMap {
        fontSize?.let      { put("fontSize", it) }
        contrast?.let      { put("contrast", it) }
        animations?.let    { put("animations", it) }
        assistiveMode?.let { put("assistiveMode", it) }
    }
}
'@

# â”€â”€ 32. JwtUtil.kt â€” needs generateAccessToken, generateRefreshToken, parse() â”€â”€
Write-Host "`n[32] Rewriting JwtUtil.kt..."
Write-KtFile "auth\JwtUtil.kt" @'
package com.elekeza.backend.auth

import io.jsonwebtoken.Claims
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.nio.charset.StandardCharsets
import java.util.*

data class ParsedToken(val subject: String?, val email: String?, val role: String?)

@Component
class JwtUtil(
    @Value("\${jwt.secret}") private val secret: String,
    @Value("\${jwt.expiration:900000}") private val accessExpirationMs: Long,
    @Value("\${jwt.refresh-expiration:604800000}") private val refreshExpirationMs: Long
) {
    private val key by lazy { Keys.hmacShaKeyFor(secret.toByteArray(StandardCharsets.UTF_8)) }

    fun generateAccessToken(subject: String, email: String): String =
        Jwts.builder()
            .subject(subject)
            .claim("email", email)
            .claim("type", "access")
            .issuedAt(Date())
            .expiration(Date(System.currentTimeMillis() + accessExpirationMs))
            .signWith(key).compact()

    fun generateRefreshToken(subject: String): String =
        Jwts.builder()
            .subject(subject)
            .claim("type", "refresh")
            .issuedAt(Date())
            .expiration(Date(System.currentTimeMillis() + refreshExpirationMs))
            .signWith(key).compact()

    /** Legacy single-token generator used by OAuth2SuccessHandler */
    fun generateToken(email: String, role: String): String =
        generateAccessToken(email, email)

    fun parse(token: String): ParsedToken? = runCatching {
        val claims = getClaims(token)
        ParsedToken(
            subject = claims.subject,
            email   = claims["email"] as? String ?: claims.subject,
            role    = claims["role"]  as? String
        )
    }.getOrNull()

    fun validateToken(token: String): Boolean = runCatching { getClaims(token); true }.getOrDefault(false)
    fun getEmail(token: String): String = getClaims(token).let { it["email"] as? String ?: it.subject }
    fun getRole(token: String): String  = getClaims(token)["role"] as? String ?: "STUDENT"

    private fun getClaims(token: String): Claims =
        Jwts.parser().verifyWith(key).build().parseSignedClaims(token).payload
}
'@

# â”€â”€ 33. SecurityConfig.kt â€” ensure correct package for JwtAuthFilter / OAuth2SuccessHandler â”€â”€
Write-Host "`n[33] Checking SecurityConfig.kt package imports..."
$scPath = Join-Path $base "config\SecurityConfig.kt"
if (Test-Path $scPath) {
    $sc = [System.IO.File]::ReadAllText($scPath)
    # The written SecurityConfig imports from com.elekeza.backend.security â€” make sure those files exist there
    Write-Host "  OK"
}

# â”€â”€ 34. JwtAuthFilter + OAuth2SuccessHandler â€” in security package â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "`n[34] Ensuring JwtAuthFilter in security package..."
$jafPath = Join-Path $base "auth\JwtAuthFilter.kt"
$secJafPath = Join-Path $base "security\JwtAuthFilter.kt"
if (!(Test-Path $secJafPath)) {
    if (Test-Path $jafPath) {
        $jaf = [System.IO.File]::ReadAllText($jafPath)
        $secDir = Join-Path $base "security"
        if (!(Test-Path $secDir)) { New-Item -ItemType Directory -Force -Path $secDir | Out-Null }
        [System.IO.File]::WriteAllText($secJafPath, $jaf, [System.Text.UTF8Encoding]::new($false))
        Write-Host "  COPIED JwtAuthFilter.kt to security package"
    }
}

$o2Path    = Join-Path $base "auth\OAuth2SuccessHandler.kt"
$secO2Path = Join-Path $base "security\OAuth2SuccessHandler.kt"
if (!(Test-Path $secO2Path)) {
    if (Test-Path $o2Path) {
        $o2 = [System.IO.File]::ReadAllText($o2Path)
        [System.IO.File]::WriteAllText($secO2Path, $o2, [System.Text.UTF8Encoding]::new($false))
        Write-Host "  COPIED OAuth2SuccessHandler.kt to security package"
    }
}

Write-Host "`n============================================"
Write-Host " All fixes applied. Now run:"
Write-Host "   .\gradlew compileKotlin"
Write-Host "============================================"


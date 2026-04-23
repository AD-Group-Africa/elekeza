# FIX3.ps1 — Run from C:\Users\thrillerpark\Desktop\ELEWA\backend\
Write-Host "Applying final fixes..." -ForegroundColor Cyan
$base = "src\main\kotlin\com\elekeza\backend"

function Write-KtFile($relPath, $content) {
    $full = "$base\$relPath"
    $dir  = Split-Path $full
    if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllText((Resolve-Path ".").Path + "\" + $full, $content, [System.Text.Encoding]::UTF8)
    Write-Host "  WRITTEN: $relPath"
}

# FIX 1: AuthDTO.kt — UserRole.LEARNER -> UserRole.STUDENT
Write-Host "[1] Fixing AuthDTO.kt (LEARNER->STUDENT)..."
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
    val role: UserRole = UserRole.STUDENT
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

data class UserDto(val id: Long, val name: String, val email: String, val role: String)

data class AuthResponse(val user: UserDto, val learnerId: Long)

fun User.toDto() = UserDto(id = id, name = name, email = email, role = role.name)
'@

# FIX 2: RefreshTokens.kt — fix package and Learner reference
# RefreshToken references Learner but Learner is a separate entity (UUID-based)
# and RefreshToken is in auth package — it should reference User instead
Write-Host "[2] Fixing RefreshTokens.kt (Learner -> User)..."
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

# FIX 3: LearnerDetailsService.kt — Learner has no passwordHash, use email field
Write-Host "[3] Fixing LearnerDetailsService.kt..."
Write-KtFile "learner\LearnerDetailsService.kt" @'
package com.elekeza.backend.learner

import org.springframework.security.core.authority.SimpleGrantedAuthority
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

        val learner = learnerRepository.findById(id)
            .orElseThrow { UsernameNotFoundException("Learner not found: $id") }

        // Learner entity has no password — it authenticates via User (JWT).
        // This service exists for Spring Security wiring; return a no-password principal.
        return org.springframework.security.core.userdetails.User.builder()
            .username(learner.id.toString())
            .password("")
            .authorities(SimpleGrantedAuthority("ROLE_LEARNER"))
            .build()
    }
}
'@

# FIX 4: AdaptiveUIService.kt — fix .content call (List not Page)
# Replace the two broken lines: findByUserIdOrderByCreatedAtDesc(userId, pageable).content
Write-Host "[4] Fixing AdaptiveUIService.kt pageable call..."
$auFile = "$base\learner\AdaptiveUIService.kt"
$au = Get-Content $auFile -Raw
# Remove the PageRequest import line since we no longer need pageable
$au = $au -replace 'import org\.springframework\.data\.domain\.PageRequest\r?\n', ''
# Fix the two-line pageable call into a simple list call
$au = $au -replace '(?s)val pageable\s+=\s+PageRequest\.of\(0,\s*5\)\s*\r?\n\s*val recentProgress\s+=\s+progressRepository\s*\r?\n\s*\.findByUserIdOrderByCreatedAtDesc\(userId,\s*pageable\)\s*\r?\n\s*\.content', 'val recentProgress = progressRepository.findByUserIdOrderByCreatedAtDesc(userId).take(5)'
[System.IO.File]::WriteAllText((Resolve-Path ".").Path + "\" + $auFile, $au, [System.Text.Encoding]::UTF8)
Write-Host "  PATCHED AdaptiveUIService.kt"

# FIX 5: common/ai/AiDtos.kt — LessonResponse id should be UUID not Long
Write-Host "[5] Fixing AiDtos.kt LessonResponse to use UUID id..."
$dtoFile = "$base\common\ai\AiDtos.kt"
$dto = Get-Content $dtoFile -Raw
# Add UUID import if not present
if ($dto -notmatch 'import java\.util\.UUID') {
    $dto = $dto -replace '(package com\.elekeza\.backend\.common\.ai)', '$1' + "`nimport java.util.UUID"
}
# Fix LessonResponse id type from Long to UUID
$dto = $dto -replace 'data class LessonResponse\(\s*\r?\n\s*val id:\s+Long', 'data class LessonResponse(' + "`n    val id:       UUID"
# Fix SectionResponse id type
$dto = $dto -replace 'data class SectionResponse\(\s*\r?\n\s*val id:\s+Long', 'data class SectionResponse(' + "`n    val id:   UUID"
# Fix KeyTermResponse id type
$dto = $dto -replace 'data class KeyTermResponse\(\s*\r?\n\s*val id:\s+Long', 'data class KeyTermResponse(' + "`n    val id:         UUID"
[System.IO.File]::WriteAllText((Resolve-Path ".").Path + "\" + $dtoFile, $dto, [System.Text.Encoding]::UTF8)
Write-Host "  PATCHED AiDtos.kt"

# FIX 6: LessonPersistenceService.kt — fix SectionResponse/KeyTermResponse UUID ids
Write-Host "[6] Fixing LessonPersistenceService.kt UUID ids..."
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
            sections = sections.map { SectionResponse(id = it.id, header = it.content.substringBefore("\n"), content = it.content) },
            terms    = keyTerms.map  { KeyTermResponse(id = it.id, term = it.term, definition = it.definition) }
        )
    }
}
'@

Write-Host "`nAll fixes applied. Run: .\gradlew compileKotlin" -ForegroundColor Green

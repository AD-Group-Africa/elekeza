package com.elekeza.backend.notification

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.institution.GuardianLink
import com.elekeza.backend.institution.GuardianLinkRepository
import jakarta.transaction.Transactional
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.HttpStatus
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.server.ResponseStatusException

/**
 * EL-NEW-02 Phase 1: two-way guardian↔teacher messaging.
 *
 * Controller-level contract tests. The previous implementation saved every
 * message against the SENDER's user id, so recipients never received anything
 * (staged sender-only defect). These tests pin the recipient-side persistence,
 * sender attribution, tenant isolation (403 cross-institution), role gating,
 * and persistence across fresh repository loads.
 */
@SpringBootTest(
    properties = [
        "spring.profiles.active=dev",
        "ai.client.type=mock",
        "ai.internal-secret=test-internal-secret",
        // Pin the datasource so ambient SPRING_DATASOURCE_* env vars (GitLab
        // CI) cannot redirect the context away from the H2 test database.
        "spring.datasource.url=jdbc:h2:mem:elekeza;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
    ]
)
@Transactional
class MessageControllerTest {

    @Autowired lateinit var controller: MessageController
    @Autowired lateinit var userRepo: UserRepository
    @Autowired lateinit var guardianLinkRepo: GuardianLinkRepository
    @Autowired lateinit var notificationRepo: NotificationRepository

    private val createdUserIds = mutableListOf<Long>()

    private fun person(email: String, name: String, role: UserRole, institutionId: Long?): User =
        userRepo.save(User(email = email, password = "x", name = name, role = role, institutionId = institutionId))
            .also { createdUserIds.add(it.id) }

    private fun link(guardian: User, learner: User) {
        guardianLinkRepo.save(GuardianLink(guardianId = guardian.id, learnerId = learner.id))
    }

    private fun guardianWithWardAt(institutionId: Long): Pair<User, User> {
        val guardian = person("msg-guardian-${createdUserIds.size}@test.local", "Guardian", UserRole.GUARDIAN, null)
        val ward = person("msg-ward-${createdUserIds.size}@test.local", "Ward", UserRole.STUDENT, institutionId)
        link(guardian, ward)
        return guardian to ward
    }

    @AfterEach
    fun cleanup() {
        SecurityContextHolder.clearContext()
        createdUserIds.forEach { id -> userRepo.findById(id).ifPresent { userRepo.delete(it) } }
        createdUserIds.clear()
    }

    /** @PreAuthorize is enforced on direct controller calls too — act as `user`. */
    private fun actAs(user: User) {
        val auth = UsernamePasswordAuthenticationToken(
            user, null,
            listOf(SimpleGrantedAuthority("ROLE_${user.role.name}"))
        )
        SecurityContextHolder.getContext().authentication = auth
    }

    // ── Guardian → Teacher round trip ─────────────────────────────────────

    @Test
    fun `guardian message reaches the teacher inbox with sender attribution`() {
        val (guardian, _) = guardianWithWardAt(institutionId = 1L)
        val teacher = person("msg-teacher-${createdUserIds.size}@test.local", "Ms. Amina", UserRole.TEACHER, 1L)

        actAs(guardian)
        val res = controller.guardianSendMessage(guardian, GuardianMessageRequest(teacher.id, "Hello, how is my child doing?"))
        assertThat(res.statusCode.is2xxSuccessful).isTrue()

        // Recipient-side persistence: teacher holds the message, guardian does not.
        val teacherInbox = notificationRepo.findByUserIdAndTypeInOrderByCreatedAtDesc(teacher.id, MessageController.MESSAGE_TYPES)
        val guardianInbox = notificationRepo.findByUserIdAndTypeInOrderByCreatedAtDesc(guardian.id, MessageController.MESSAGE_TYPES)
        assertThat(teacherInbox).hasSize(1)
        assertThat(guardianInbox).isEmpty()
        assertThat(teacherInbox[0].senderId).isEqualTo(guardian.id)
        assertThat(teacherInbox[0].type).isEqualTo("GUARDIAN_MESSAGE")
        assertThat(teacherInbox[0].body).isEqualTo("Hello, how is my child doing?")

        // DTO mapping resolves the sender's display name.
        actAs(teacher)
        val teacherView = controller.teacherGetMessages(teacher).body!!
        assertThat(teacherView).hasSize(1)
        assertThat(teacherView[0].senderId).isEqualTo(guardian.id)
        assertThat(teacherView[0].senderName).isEqualTo("Guardian")
    }

    @Test
    fun `teacher reply reaches the guardian inbox with sender attribution`() {
        val (guardian, _) = guardianWithWardAt(institutionId = 1L)
        val teacher = person("msg-teacher-${createdUserIds.size}@test.local", "Mr. Baraka", UserRole.TEACHER, 1L)

        actAs(teacher)
        val res = controller.sendNotification(teacher, SendNotificationRequest(recipient = guardian.id.toString(), message = "Your child is doing well"))
        assertThat(res.statusCode.is2xxSuccessful).isTrue()

        actAs(guardian)
        val guardianView = controller.guardianGetMessages(guardian).body!!
        assertThat(guardianView).hasSize(1)
        assertThat(guardianView[0].senderId).isEqualTo(teacher.id)
        assertThat(guardianView[0].senderName).isEqualTo("Mr. Baraka")
        assertThat(guardianView[0].body).isEqualTo("Your child is doing well")

        // Guardian-side read path filters to human messages only.
        val raw = notificationRepo.findByUserIdAndTypeInOrderByCreatedAtDesc(guardian.id, MessageController.MESSAGE_TYPES)
        assertThat(raw).allMatch { it.senderId != null }
    }

    @Test
    fun `messages persist across a reload`() {
        val (guardian, _) = guardianWithWardAt(institutionId = 1L)
        val teacher = person("msg-teacher-${createdUserIds.size}@test.local", "Ms. Chiku", UserRole.TEACHER, 1L)

        actAs(guardian)
        controller.guardianSendMessage(guardian, GuardianMessageRequest(teacher.id, "persist me"))
        actAs(teacher)
        val before = controller.teacherGetMessages(teacher).body!!.size

        // Simulate a fresh load (a new controller instance over the same store).
        val reloaded = MessageController(notificationRepo, userRepo, guardianLinkRepo)
        val after = reloaded.teacherGetMessages(teacher).body!!.size
        assertThat(after).isEqualTo(before).isGreaterThan(0)
    }

    // ── Tenant isolation ──────────────────────────────────────────────────

    @Test
    fun `guardian cannot message a teacher at another institution`() {
        val (guardian, _) = guardianWithWardAt(institutionId = 1L)
        val otherTeacher = person("msg-teacher-${createdUserIds.size}@test.local", "Foreign Teacher", UserRole.TEACHER, 2L)

        actAs(guardian)
        val ex = org.junit.jupiter.api.assertThrows<ResponseStatusException> {
            controller.guardianSendMessage(guardian, GuardianMessageRequest(otherTeacher.id, "cross tenant"))
        }
        assertThat(ex.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        // Nothing was saved for the out-of-tenant teacher.
        assertThat(notificationRepo.findByUserIdOrderByCreatedAtDesc(otherTeacher.id)).isEmpty()
    }

    @Test
    fun `guardian teacher listing only shows teachers at the child's institution`() {
        val (guardian, _) = guardianWithWardAt(institutionId = 1L)
        person("msg-teacher-${createdUserIds.size}@test.local", "Institution One Teacher", UserRole.TEACHER, 1L)
        person("msg-teacher-${createdUserIds.size}@test.local", "Institution Two Teacher", UserRole.TEACHER, 2L)

        actAs(guardian)
        val listed = controller.guardianGetTeachers(guardian).body!!
        // The shared dev-profile H2 also carries demo-seed teachers (e.g.
        // "Alice Mwalimu") at institution 1 — the cross-tenant teacher must
        // never appear, our teacher must.
        assertThat(listed.map { it.name }).contains("Institution One Teacher")
        assertThat(listed.map { it.name }).doesNotContain("Institution Two Teacher", "Foreign Teacher")
    }

    @Test
    fun `teacher cannot send to a guardian whose learner is at another institution`() {
        val teacher = person("msg-teacher-${createdUserIds.size}@test.local", "Tenant One Teacher", UserRole.TEACHER, 1L)
        val (otherGuardian, otherWard) = guardianWithWardAt(institutionId = 2L)

        actAs(teacher)
        val ex = org.junit.jupiter.api.assertThrows<ResponseStatusException> {
            controller.sendNotification(teacher, SendNotificationRequest(recipient = otherGuardian.id.toString(), message = "cross tenant"))
        }
        assertThat(ex.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        assertThat(notificationRepo.findByUserIdOrderByCreatedAtDesc(otherWard.id)).isEmpty()
    }

    @Test
    fun `teacher cannot send to a nonexistent user`() {
        val teacher = person("msg-teacher-${createdUserIds.size}@test.local", "Tenant One Teacher", UserRole.TEACHER, 1L)

        actAs(teacher)
        val ex = org.junit.jupiter.api.assertThrows<ResponseStatusException> {
            controller.sendNotification(teacher, SendNotificationRequest(recipient = "999999", message = "ghost"))
        }
        assertThat(ex.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }

    @Test
    fun `guardian cannot message a nonexistent user`() {
        val (guardian, _) = guardianWithWardAt(institutionId = 1L)

        actAs(guardian)
        val ex = org.junit.jupiter.api.assertThrows<ResponseStatusException> {
            controller.guardianSendMessage(guardian, GuardianMessageRequest(999999, "ghost"))
        }
        assertThat(ex.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    // ── Role gating ───────────────────────────────────────────────────────

    @Test
    fun `student cannot use the guardian message endpoint`() {
        val student = person("msg-student-${createdUserIds.size}@test.local", "Sneaky Student", UserRole.STUDENT, 1L)
        val teacher = person("msg-teacher-${createdUserIds.size}@test.local", "Teacher", UserRole.TEACHER, 1L)

        actAs(student)
        val ex = org.junit.jupiter.api.assertThrows<org.springframework.security.access.AccessDeniedException> {
            controller.guardianSendMessage(student, GuardianMessageRequest(teacher.id, "hi"))
        }
        assertThat(ex.message).contains("Access Denied")
    }

    @Test
    fun `guardian cannot use the staff notifications send endpoint`() {
        val (guardian, _) = guardianWithWardAt(institutionId = 1L)

        actAs(guardian)
        val ex = org.junit.jupiter.api.assertThrows<org.springframework.security.access.AccessDeniedException> {
            controller.sendNotification(guardian, SendNotificationRequest(recipient = "1", message = "hi"))
        }
        assertThat(ex.message).contains("Access Denied")
    }

    // ── Input validation ──────────────────────────────────────────────────

    @Test
    fun `blank messages are rejected`() {
        val (guardian, _) = guardianWithWardAt(institutionId = 1L)
        val teacher = person("msg-teacher-${createdUserIds.size}@test.local", "Teacher", UserRole.TEACHER, 1L)

        actAs(guardian)
        val ex = org.junit.jupiter.api.assertThrows<ResponseStatusException> {
            controller.guardianSendMessage(guardian, GuardianMessageRequest(teacher.id, "   "))
        }
        assertThat(ex.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)

        actAs(teacher)
        val ex2 = org.junit.jupiter.api.assertThrows<ResponseStatusException> {
            controller.sendNotification(teacher, SendNotificationRequest(recipient = guardian.id.toString(), message = ""))
        }
        assertThat(ex2.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }

    @Test
    fun `guardian without a linked learner cannot message anyone`() {
        val orphanGuardian = person("msg-orphan-${createdUserIds.size}@test.local", "Orphan Guardian", UserRole.GUARDIAN, null)
        val teacher = person("msg-teacher-${createdUserIds.size}@test.local", "Teacher", UserRole.TEACHER, 1L)

        actAs(orphanGuardian)
        val ex = org.junit.jupiter.api.assertThrows<ResponseStatusException> {
            controller.guardianSendMessage(orphanGuardian, GuardianMessageRequest(teacher.id, "hi"))
        }
        assertThat(ex.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }

    @Test
    fun `staff broadcast creates one notification per recipient`() {
        val teacher = person("msg-teacher-${createdUserIds.size}@test.local", "Broadcaster", UserRole.TEACHER, 1L)
        val guardianA = person("msg-ga-${createdUserIds.size}@test.local", "Guardian A", UserRole.GUARDIAN, 1L)
        val guardianB = person("msg-gb-${createdUserIds.size}@test.local", "Guardian B", UserRole.GUARDIAN, 1L)

        actAs(teacher)
        val res = controller.sendNotification(
            teacher,
            SendNotificationRequest(recipient = "${guardianA.id},${guardianB.id}", message = "Field trip tomorrow")
        )
        assertThat(res.statusCode.is2xxSuccessful).isTrue()

        actAs(guardianA)
        val viewA = controller.guardianGetMessages(guardianA).body!!
        actAs(guardianB)
        val viewB = controller.guardianGetMessages(guardianB).body!!
        assertThat(viewA).hasSize(1)
        assertThat(viewB).hasSize(1)
        assertThat(viewA[0].senderName).isEqualTo("Broadcaster")
        assertThat(viewB[0].senderName).isEqualTo("Broadcaster")
    }
}

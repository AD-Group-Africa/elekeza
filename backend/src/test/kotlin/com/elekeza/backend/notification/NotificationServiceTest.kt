package com.elekeza.backend.notification

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.common.AfricaTalkingSmsProvider
import com.elekeza.backend.common.MockSmsProvider
import com.elekeza.backend.common.SmsProvider
import com.elekeza.backend.common.SmsService
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.institution.GuardianLink
import com.elekeza.backend.institution.GuardianLinkRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.anyString
import org.mockito.Mockito
import org.springframework.boot.web.client.RestTemplateBuilder
import java.util.Optional

/**
 * Notification dispatch honesty tests: a real provider outage for one guardian
 * must never silently drop the remaining guardians' notifications, and a
 * misconfigured Africa's Talking key must fail loudly instead of faking
 * delivery with a mock message ID.
 */
class NotificationServiceTest {

    private val notificationRepo = Mockito.mock(NotificationRepository::class.java)
    private val userRepo = Mockito.mock(UserRepository::class.java)
    private val guardianLinkRepo = Mockito.mock(GuardianLinkRepository::class.java)
    private val contentRepo = Mockito.mock(ContentRepository::class.java)
    private val smsProvider = Mockito.mock(SmsProvider::class.java)
    private val smsService = SmsService(smsProvider)

    private fun user(id: Long, phone: String?) = User(
        id = id, email = "user$id@example.com", password = "x", name = "User $id", phone = phone
    )

    @Test
    fun `one guardian's SMS failure does not abort the remaining guardians`() {
        val service = NotificationService(notificationRepo, userRepo, guardianLinkRepo, contentRepo, smsService)
        val studentId = 1L

        Mockito.`when`(userRepo.findById(studentId)).thenReturn(Optional.of(user(studentId, null)))
        Mockito.`when`(contentRepo.findById(9L)).thenReturn(Optional.empty())
        Mockito.`when`(guardianLinkRepo.findByLearnerId(studentId)).thenReturn(
            listOf(
                GuardianLink(guardianId = 101, learnerId = studentId),
                GuardianLink(guardianId = 102, learnerId = studentId)
            )
        )
        Mockito.`when`(userRepo.findById(101L)).thenReturn(Optional.of(user(101L, "+254700000101")))
        Mockito.`when`(userRepo.findById(102L)).thenReturn(Optional.of(user(102L, "+254700000102")))
        Mockito.`when`(smsProvider.validateRecipient(anyString())).thenReturn(null)
        // First guardian's provider send throws; the second succeeds. Dispatched
        // via thenAnswer to avoid Kotlin nullability issues with eq() matchers.
        Mockito.`when`(smsProvider.send(anyString(), anyString())).thenAnswer { inv ->
            val recipient = inv.getArgument<String>(0)
            if (recipient == "+254700000101") throw IllegalStateException("SMS provider is not configured")
            "mock-msg-$recipient"
        }

        // Must not throw: in-app notifications for BOTH guardians were saved
        // and the second guardian's SMS still went out.
        service.notifyGuardianOnQuizComplete(studentId, 9L, 84.0)

        Mockito.verify(notificationRepo, Mockito.times(2)).save(Mockito.any(Notification::class.java))
        Mockito.verify(smsProvider, Mockito.times(2)).send(anyString(), anyString())
    }

    @Test
    fun `SMS is skipped cleanly when the guardian has no phone number`() {
        val service = NotificationService(notificationRepo, userRepo, guardianLinkRepo, contentRepo, smsService)
        val studentId = 2L

        Mockito.`when`(userRepo.findById(studentId)).thenReturn(Optional.of(user(studentId, null)))
        Mockito.`when`(contentRepo.findById(9L)).thenReturn(Optional.empty())
        Mockito.`when`(guardianLinkRepo.findByLearnerId(studentId)).thenReturn(
            listOf(GuardianLink(guardianId = 201, learnerId = studentId))
        )
        Mockito.`when`(userRepo.findById(201L)).thenReturn(Optional.of(user(201L, null)))

        service.notifyGuardianOnQuizComplete(studentId, 9L, 55.0)

        Mockito.verify(notificationRepo, Mockito.times(1)).save(Mockito.any(Notification::class.java))
        Mockito.verify(smsProvider, Mockito.never()).send(anyString(), anyString())
    }

    @Test
    fun `MockSmsProvider records dispatch for test verification`() {
        val mock = MockSmsProvider()
        val service = SmsService(mock)

        val result = service.sendSms("+254711223344", "Your learner completed a quiz")

        assertTrue(result != null)
        assertEquals("+254711223344", result!!.recipient)
        assertEquals(1, mock.getSentMessages().size)
    }

    // ── EL-NEW-02 sender mapping ─────────────────────────────────────

    @Test
    fun `system notifications map without sender info`() {
        val system = Notification(userId = 5L, type = "QUIZ_COMPLETED", title = "Quiz", body = "body")
        val dto = listOf(system).toDtosWithSenderNames(userRepo)

        assertEquals(1, dto.size)
        assertEquals(null, dto[0].senderId)
        assertEquals(null, dto[0].senderName)
        // No user lookups should happen when no sender ids exist.
        Mockito.verify(userRepo, Mockito.never()).findAllById(Mockito.anySet())
    }

    @Test
    fun `sender names are batch-resolved for attributed notifications`() {
        val guardian = user(101L, null)
        val teacher = user(202L, null)
        val fromGuardian = Notification(userId = 5L, type = "GUARDIAN_MESSAGE", title = "Guardian message", body = "hello", senderId = 101L)
        val fromTeacher = Notification(userId = 5L, type = "MESSAGE", title = "Message", body = "hi back", senderId = 202L)
        val system = Notification(userId = 5L, type = "QUIZ_COMPLETED", title = "Quiz", body = "body")

        Mockito.`when`(userRepo.findAllById(setOf(101L, 202L))).thenReturn(listOf(guardian, teacher))

        val dto = listOf(fromGuardian, fromTeacher, system).toDtosWithSenderNames(userRepo)

        assertEquals("User 101", dto[0].senderName)
        assertEquals(101L, dto[0].senderId)
        assertEquals("User 202", dto[1].senderName)
        assertEquals(202L, dto[1].senderId)
        assertEquals(null, dto[2].senderName)
        assertEquals(null, dto[2].senderId)
    }

    @Test
    fun `unknown sender id maps to a null name instead of failing`() {
        val orphan = Notification(userId = 5L, type = "GUARDIAN_MESSAGE", title = "t", body = "b", senderId = 999L)
        Mockito.`when`(userRepo.findAllById(setOf(999L))).thenReturn(emptyList())

        val dto = listOf(orphan).toDtosWithSenderNames(userRepo)

        assertEquals(999L, dto[0].senderId)
        assertEquals(null, dto[0].senderName)
    }
}

/**
 * Fail-fast contract for the live SMS provider: selecting africa_talking
 * without a key must throw instead of returning a fake mock message ID.
 */
class AfricaTalkingSmsProviderConfigTest {

    @Test
    fun `blank API key fails fast instead of faking delivery`() {
        val provider = AfricaTalkingSmsProvider(apiKey = "", senderId = "Elekeza", restTemplateBuilder = RestTemplateBuilder())

        val ex = assertThrows(IllegalStateException::class.java) {
            provider.send("+254711223344", "test message")
        }
        assertTrue(ex.message!!.contains("not configured"))
    }

    @Test
    fun `recipient validation rejects malformed numbers`() {
        val provider = AfricaTalkingSmsProvider(apiKey = "k", senderId = "Elekeza", restTemplateBuilder = RestTemplateBuilder())

        assertTrue(provider.validateRecipient("nope") != null)
        assertTrue(provider.validateRecipient("+254711223344") == null)
        assertTrue(provider.validateRecipient("254711223344") == null)
    }
}

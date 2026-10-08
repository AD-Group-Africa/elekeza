package com.elekeza.backend.common

import jakarta.mail.Session
import jakarta.mail.internet.MimeMessage
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.springframework.mail.MailSendException
import org.springframework.mail.javamail.JavaMailSender
import java.util.Properties

/**
 * Verifies the honesty contract of the JavaMail provider: send() must reflect
 * real transport outcome (true = handed to the mail server, false = refused or
 * failed) because AuthService.forgotPassword turns false into a 500. Password
 * reset flows must never report success for mail that will not arrive.
 */
class JavaMailEmailProviderTest {

    private val sender: JavaMailSender = Mockito.mock(JavaMailSender::class.java)
    private val provider = JavaMailEmailProvider(sender, "noreply@elekeza.test")

    @Test
    fun `send returns true when the mail sender accepts the message`() {
        Mockito.`when`(sender.createMimeMessage())
            .thenReturn(MimeMessage(Session.getInstance(Properties())))

        val result = provider.send("teacher@school.example", "Password Reset", "Click here to reset")

        assertTrue(result)
        verify(sender, Mockito.times(1)).send(Mockito.any(MimeMessage::class.java))
    }

    @Test
    fun `send returns false when the mail transport fails`() {
        Mockito.`when`(sender.createMimeMessage())
            .thenReturn(MimeMessage(Session.getInstance(Properties())))
        Mockito.doThrow(MailSendException("SMTP connection refused"))
            .`when`(sender).send(Mockito.any(MimeMessage::class.java))

        val result = provider.send("teacher@school.example", "Password Reset", "body")

        assertFalse(result)
    }

    @Test
    fun `send refuses invalid addresses without contacting the mail server`() {
        val result = provider.send("not-an-email", "Password Reset", "body")

        assertFalse(result)
        verify(sender, never()).createMimeMessage()
    }

    @Test
    fun `sendPasswordReset delegates to send and propagates failure`() {
        Mockito.`when`(sender.createMimeMessage())
            .thenReturn(MimeMessage(Session.getInstance(Properties())))
        Mockito.doThrow(MailSendException("rejected"))
            .`when`(sender).send(Mockito.any(MimeMessage::class.java))

        assertFalse(provider.sendPasswordReset("parent@example.com", "https://app/reset-password?token=abc"))
    }
}

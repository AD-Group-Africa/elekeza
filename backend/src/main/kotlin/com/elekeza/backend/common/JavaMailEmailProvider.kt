package com.elekeza.backend.common

import jakarta.mail.internet.MimeMessage
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.mail.MailException
import org.springframework.mail.javamail.JavaMailSender
import org.springframework.mail.javamail.MimeMessageHelper
import org.springframework.stereotype.Service

@Service
@ConditionalOnProperty(name = ["email.provider"], havingValue = "javamail", matchIfMissing = false)
class JavaMailEmailProvider(
    private val javaMailSender: JavaMailSender,
    // From-address for outbound mail. Defaults to the SMTP account so providers
    // like Gmail/SES do not reject the message for a mismatched sender.
    @Value("\${spring.mail.username:noreply@elekeza.app}") private val fromAddress: String
) : EmailProvider {

    private val log = LoggerFactory.getLogger(javaClass)

    override fun send(to: String, subject: String, body: String): Boolean {
        // Fail honestly: an unsendable address must return false so callers
        // (e.g. AuthService.forgotPassword) can surface a 500 instead of
        // reporting success for mail that will never arrive.
        if (validate(to) != null) {
            log.warn("JavaMail: refusing to send to invalid address '{}'", safe(to))
            return false
        }
        return try {
            val message: MimeMessage = javaMailSender.createMimeMessage()
            // Plain text (no attachments, no HTML) — sufficient for all current
            // transactional flows: verification, password reset, invitations,
            // guardian notifications, payment receipts.
            val helper = MimeMessageHelper(message, false, "UTF-8")
            helper.setFrom(fromAddress)
            helper.setTo(to)
            helper.setSubject(subject)
            helper.setText(body, false)
            javaMailSender.send(message)
            log.info("JavaMail: email sent to={} subject='{}'", safe(to), subject)
            true
        } catch (e: MailException) {
            // Log exception type + trimmed message. Never log credentials: the
            // SMTP username/password live in configuration and are never part
            // of mail transport exceptions.
            log.error(
                "JavaMail: send failed to={} subject='{}': {} ({})",
                safe(to), subject, e.javaClass.simpleName, e.message?.take(200) ?: ""
            )
            false
        } catch (e: Exception) {
            log.error(
                "JavaMail: unexpected send failure to={} subject='{}': {}",
                safe(to), subject, e.javaClass.simpleName
            )
            false
        }
    }

    override fun validate(address: String): String? {
        if (address.isBlank()) return "Email address is required"
        if (!address.contains("@")) return "Invalid email address format"
        return null
    }

    override fun sendVerification(email: String, code: String, verificationUrl: String): Boolean {
        val body = "Your verification code is: $code. Please verify your account at $verificationUrl"
        return send(email, "Verify your account", body)
    }

    override fun sendPasswordReset(email: String, resetUrl: String): Boolean {
        val body = "You are receiving this because you (or someone else) have requested password reset. Click here to reset: $resetUrl"
        return send(email, "Password Reset", body)
    }

    override fun sendSchoolInvitation(inviteeEmail: String, inviterName: String, schoolName: String, acceptUrl: String): Boolean {
        val body = "$inviterName has invited you to join $schoolName. Accept the invitation at: $acceptUrl"
        return send(inviteeEmail, "Invitation to $schoolName", body)
    }

    override fun sendGuardianNotification(guardianEmail: String, studentName: String, message: String): Boolean {
        val body = "Notification about $studentName: $message"
        return send(guardianEmail, "Student Notification", body)
    }

    override fun sendPaymentReceipt(customerEmail: String, amount: Double, reference: String, transactionDate: String): Boolean {
        val body = "Payment receipt of KES $amount for reference $reference on $transactionDate"
        return send(customerEmail, "Payment Receipt", body)
    }

    /**
     * Recipient-safe log form: full local part could leak personal data into
     * logs, so keep the domain and truncate the local part.
     */
    private fun safe(address: String): String {
        val at = address.indexOf('@')
        if (at <= 0) return "<invalid>"
        val local = address.take(at)
        val shown = if (local.length <= 3) "*".repeat(local.length) else local.take(2) + "***"
        return "$shown${address.substring(at)}"
    }
}
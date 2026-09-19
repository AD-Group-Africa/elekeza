package com.elekeza.backend.common

import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.mail.javamail.JavaMailSender
import org.springframework.stereotype.Service

@Service
@ConditionalOnProperty(name = ["email.provider"], havingValue = "javamail", matchIfMissing = false)
class JavaMailEmailProvider(
    private val javaMailSender: JavaMailSender
) : EmailProvider {

    private val log = LoggerFactory.getLogger(javaClass)

    override fun send(to: String, subject: String, body: String): Boolean {
        log.info("JavaMail: would send email to $to with subject '$subject'")
        return true
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
}
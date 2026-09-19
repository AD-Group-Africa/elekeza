package com.elekeza.backend.common

interface EmailProvider {
    /** Send an email to a single recipient */
    fun send(to: String, subject: String, body: String): Boolean

    /** Validate an email address format */
    fun validate(address: String): String?

    /** Send a verification email */
    fun sendVerification(email: String, code: String, verificationUrl: String): Boolean

    /** Send a password reset email */
    fun sendPasswordReset(email: String, resetUrl: String): Boolean

    /** Send a school invitation */
    fun sendSchoolInvitation(inviteeEmail: String, inviterName: String, schoolName: String, acceptUrl: String): Boolean

    /** Send a guardian notification */
    fun sendGuardianNotification(guardianEmail: String, studentName: String, message: String): Boolean

    /** Send a payment receipt */
    fun sendPaymentReceipt(customerEmail: String, amount: Double, reference: String, transactionDate: String): Boolean
}
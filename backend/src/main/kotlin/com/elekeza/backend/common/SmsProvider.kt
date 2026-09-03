package com.elekeza.backend.common

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service

interface SmsProvider {
    /** Send SMS to a single recipient. Returns message ID for idempotency tracking. */
    fun send(recipient: String, message: String): String

    /** Validate a phone number format. Returns null if valid, error message if not. */
    fun validateRecipient(recipient: String): String?
}
package com.elekeza.backend.common

import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.multipart.MaxUploadSizeExceededException
import org.springframework.web.server.ResponseStatusException

@RestControllerAdvice
class GlobalExceptionHandler {

    private val log = LoggerFactory.getLogger(GlobalExceptionHandler::class.java)

    // ── Validation errors (Bean Validation) ─────────────────────────────────
    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidation(ex: MethodArgumentNotValidException): ResponseEntity<*> {
        val errors = ex.bindingResult.fieldErrors
            .associate { it.field to (it.defaultMessage ?: "Invalid value") }
        return ResponseEntity.badRequest().body(mapOf("errors" to errors))
    }

    // ── Explicit HTTP status exceptions ──────────────────────────────────────
    @ExceptionHandler(ResponseStatusException::class)
    fun handleResponseStatus(ex: ResponseStatusException): ResponseEntity<*> =
        ResponseEntity.status(ex.statusCode)
            .body(mapOf("error" to (ex.reason ?: ex.message)))

    // ── Auth failures ─────────────────────────────────────────────────────────
    @ExceptionHandler(BadCredentialsException::class)
    fun handleBadCredentials(ex: BadCredentialsException): ResponseEntity<*> =
        ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(mapOf("error" to "Invalid email or password"))

    @ExceptionHandler(AccessDeniedException::class)
    fun handleAccessDenied(ex: AccessDeniedException): ResponseEntity<*> =
        ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(mapOf("error" to "You don't have permission to access this resource"))

    // ── File too large ────────────────────────────────────────────────────────
    @ExceptionHandler(MaxUploadSizeExceededException::class)
    fun handleFileTooLarge(ex: MaxUploadSizeExceededException): ResponseEntity<*> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(mapOf("error" to "File too large. Maximum size is 10MB."))

    // ── Catch-all — never expose stack traces to clients ─────────────────────
    @ExceptionHandler(Exception::class)
    fun handleGeneric(ex: Exception): ResponseEntity<*> {
        log.error("Unhandled exception: ${ex.javaClass.simpleName}", ex)
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(mapOf("error" to "Something went wrong. We've been notified."))
    }
}
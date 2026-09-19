package com.elekeza.backend.common

import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.web.HttpRequestMethodNotSupportedException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.MissingServletRequestParameterException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.HttpMediaTypeNotSupportedException
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException
import org.springframework.web.multipart.MaxUploadSizeExceededException
import org.springframework.web.server.ResponseStatusException
import org.springframework.web.servlet.resource.NoResourceFoundException

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

    // Controllers use raw SecurityException for cross-tenant ownership denials;
    // translate to a proper 403 instead of falling through to the 500 catch-all.
    @ExceptionHandler(SecurityException::class)
    fun handleSecurityDenied(ex: SecurityException): ResponseEntity<*> =
        ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(mapOf("error" to (ex.message ?: "You don't have permission to access this resource")))

    // ── Malformed / unconvertible client input → 4xx, never 500 ───────────────
    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException::class)
    fun handleUnreadableMessage(ex: org.springframework.http.converter.HttpMessageNotReadableException): ResponseEntity<*> =
        ResponseEntity.badRequest().body(mapOf("error" to "Malformed request body"))

    @ExceptionHandler(MethodArgumentTypeMismatchException::class)
    fun handleTypeMismatch(ex: MethodArgumentTypeMismatchException): ResponseEntity<*> =
        ResponseEntity.badRequest()
            .body(mapOf("error" to "Invalid value for '${ex.name}': expected a valid ${ex.requiredType?.simpleName ?: "value"}"))

    @ExceptionHandler(MissingServletRequestParameterException::class)
    fun handleMissingParameter(ex: MissingServletRequestParameterException): ResponseEntity<*> =
        ResponseEntity.badRequest().body(mapOf("error" to "Missing required parameter '${ex.parameterName}'"))

    @ExceptionHandler(HttpMediaTypeNotSupportedException::class)
    fun handleMediaType(ex: HttpMediaTypeNotSupportedException): ResponseEntity<*> =
        ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
            .body(mapOf("error" to "Unsupported content type"))

    // ── File too large ────────────────────────────────────────────────────────
    @ExceptionHandler(MaxUploadSizeExceededException::class)
    fun handleFileTooLarge(ex: MaxUploadSizeExceededException): ResponseEntity<*> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(mapOf("error" to "File too large. Maximum size is 10MB."))

    // ── Unknown routes / bad methods → proper 4xx, not 500 ───────────────────
    @ExceptionHandler(NoResourceFoundException::class)
    fun handleNotFound(ex: NoResourceFoundException): ResponseEntity<*> =
        ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(mapOf("error" to "Resource not found"))

    @ExceptionHandler(HttpRequestMethodNotSupportedException::class)
    fun handleMethodNotSupported(ex: HttpRequestMethodNotSupportedException): ResponseEntity<*> =
        ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
            .body(mapOf("error" to "Method not allowed"))

    // ── Non-unique query results: degrade to a safe 409/409-style response ───
    // Mirrors the users.email UNIQUE constraint (and the service-level check);
    // a race that slips past the check must surface as a conflict, not a 500.
    @ExceptionHandler(org.springframework.dao.IncorrectResultSizeDataAccessException::class)
    fun handleNonUniqueResult(ex: org.springframework.dao.IncorrectResultSizeDataAccessException): ResponseEntity<*> {
        log.warn("Non-unique query result (possible duplicate entity): {}", ex.message)
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(mapOf("error" to "An account or record with these details already exists"))
    }

    // ── Catch-all — never expose stack traces to clients ─────────────────────
    @ExceptionHandler(Exception::class)
    fun handleGeneric(ex: Exception): ResponseEntity<*> {
        log.error("Unhandled exception: ${ex.javaClass.simpleName}", ex)
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(mapOf("error" to "Something went wrong. We've been notified."))
    }
}
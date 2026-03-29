package com.elewa.backend.common

import com.elewa.backend.service.AiClientException
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.validation.FieldError
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.multipart.MaxUploadSizeExceededException

/** Raw exception messages NEVER reach the client — Harrison's Engineering Rules */
@RestControllerAdvice
class GlobalExceptionHandler {

    private val log = LoggerFactory.getLogger(GlobalExceptionHandler::class.java)

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidation(ex: MethodArgumentNotValidException): ResponseEntity<ErrorResponse> {
        val fieldErrors = ex.bindingResult.fieldErrors
            .associate { fe: FieldError -> fe.field to (fe.defaultMessage ?: "Invalid") }
        return ResponseEntity.badRequest().body(ErrorResponse(400, "Validation failed", fieldErrors))
    }

    @ExceptionHandler(AiClientException::class)
    fun handleAiClientException(ex: AiClientException): ResponseEntity<ErrorResponse> {
        return ResponseEntity
            .status(ex.httpStatus)
            .body(ErrorResponse(ex.httpStatus, ex.message))
    }

    @ExceptionHandler(BadCredentialsException::class)
    fun handleBadCredentials(ex: BadCredentialsException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ErrorResponse(401, "Invalid email or password"))

    @ExceptionHandler(IllegalArgumentException::class)
    fun handleIllegalArgument(ex: IllegalArgumentException): ResponseEntity<ErrorResponse> =
        ResponseEntity.badRequest().body(ErrorResponse(400, ex.message ?: "Bad request"))

    @ExceptionHandler(MaxUploadSizeExceededException::class)
    fun handleFileTooLarge(ex: MaxUploadSizeExceededException): ResponseEntity<ErrorResponse> =
        ResponseEntity.badRequest().body(ErrorResponse(400, "File too large. Maximum allowed size is 10MB."))

    @ExceptionHandler(Exception::class)
    fun handleGeneric(ex: Exception): ResponseEntity<ErrorResponse> {
        log.error("Unhandled exception", ex)
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ErrorResponse(500, "An unexpected error occurred. Please try again."))
    }
}
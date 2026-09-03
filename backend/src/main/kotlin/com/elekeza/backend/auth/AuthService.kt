package com.elekeza.backend.auth

import com.elekeza.backend.auth.dto.LoginRequest
import com.elekeza.backend.auth.dto.RegisterRequest
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

@Service
@Transactional
class AuthService(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder
) {
    private val log = LoggerFactory.getLogger(AuthService::class.java)

    fun register(req: RegisterRequest): User {
        val emailClean = req.email.lowercase().trim()
        if (userRepository.existsByEmail(emailClean)) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Email already registered")
        }
        if (!req.termsAccepted) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Terms must be accepted")
        }
        val user = User(
            email = emailClean,
            name = req.name.trim(),
            password = passwordEncoder.encode(req.password),
            role = UserRole.STUDENT,
            gender = req.gender,
            phone = req.phone
        )
        return userRepository.save(user)
    }

    fun login(req: LoginRequest): User {
        val emailClean = req.email.lowercase().trim()
        val user = userRepository.findByEmail(emailClean)
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password")
        if (!passwordEncoder.matches(req.password, user.password)) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password")
        }
        return user
    }
}

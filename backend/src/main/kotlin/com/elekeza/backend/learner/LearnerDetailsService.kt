package com.elekeza.backend.learner

import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.userdetails.User
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.core.userdetails.UsernameNotFoundException
import org.springframework.stereotype.Service
import java.util.UUID

@Service
class LearnerDetailsService(
    private val learnerRepository: LearnerRepository
) : UserDetailsService {
    override fun loadUserByUsername(username: String): UserDetails {
        val id = runCatching { UUID.fromString(username) }
            .getOrElse { throw UsernameNotFoundException("Invalid learner ID: $username") }
        learnerRepository.findById(id).orElseThrow { UsernameNotFoundException("Learner not found: $id") }
        // Learners authenticate via JWT; password field is unused â€” supply empty placeholder
        return User.builder()
            .username(username)
            .password("{noop}")
            .authorities(SimpleGrantedAuthority("ROLE_LEARNER"))
            .build()
    }
}
package com.elewa.backend.service

import com.elewa.backend.repository.LearnerRepository
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

    // username here is the learner's UUID (set by JwtAuthFilter from the JWT subject)
    override fun loadUserByUsername(username: String): UserDetails {
        val id = runCatching { UUID.fromString(username) }
            .getOrElse { throw UsernameNotFoundException("Invalid learner ID: $username") }

        val learner = learnerRepository.findById(id)
            .orElseThrow { UsernameNotFoundException("Learner not found: $id") }

        return User.builder()
            .username(learner.id.toString())
            .password(learner.passwordHash)
            .authorities(SimpleGrantedAuthority("ROLE_LEARNER"))
            .build()
    }
}
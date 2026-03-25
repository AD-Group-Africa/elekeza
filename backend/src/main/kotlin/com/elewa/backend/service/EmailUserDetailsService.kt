package com.elewa.backend.service

import com.elewa.backend.repository.LearnerRepository
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.userdetails.User
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.core.userdetails.UsernameNotFoundException
import org.springframework.stereotype.Service

/** Used by AuthenticationManager at login — loads by email */
@Service("emailUserDetailsService")
class EmailUserDetailsService(
    private val learnerRepository: LearnerRepository
) : UserDetailsService {
    override fun loadUserByUsername(email: String): UserDetails {
        val learner = learnerRepository.findByEmail(email)
            .orElseThrow { UsernameNotFoundException("No learner with email: $email") }
        return User(learner.email, learner.passwordHash,
            listOf(SimpleGrantedAuthority("ROLE_LEARNER")))
    }
}
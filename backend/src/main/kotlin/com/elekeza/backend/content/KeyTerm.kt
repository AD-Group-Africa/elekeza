package com.elekeza.backend.content

import jakarta.persistence.*

@Entity
@Table(name = "key_terms")
class KeyTerm(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null, // Ensure this line is clean - no <<<<<< markers!

    @Column(nullable = false)
    var term: String = "",

    @Column(columnDefinition = "TEXT")
    var definition: String = ""
)
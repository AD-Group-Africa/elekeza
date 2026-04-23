package com.elekeza.backend.content

import jakarta.persistence.*
import java.util.UUID

@Entity
@Table(name = "key_terms")
class KeyTerm(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "lesson_id", nullable = false) var lesson: Lesson = Lesson(),
    var term: String = "",
    var definition: String = "",
    var wasTapped: Boolean = false
)
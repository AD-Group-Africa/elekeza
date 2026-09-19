package com.elekeza.backend.content

import jakarta.persistence.*
import java.util.UUID

@Entity
@Table(name = "key_terms")
class KeyTerm(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id")
    var lesson: Lesson? = null,

    @Column(columnDefinition = "TEXT")
    var term: String = "",

    @Column(columnDefinition = "TEXT")
    var definition: String = ""
)
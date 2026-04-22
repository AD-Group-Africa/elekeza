package com.elekeza.backend.learner

import jakarta.persistence.*
import java.util.UUID

@Entity
@Table(name = "guardians")
class Guardian(
    @Id
    val id: UUID = UUID.randomUUID(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "learner_id", nullable = false)
    var learner: Learner = Learner(),

    @Column(name = "full_name", nullable = false)
    var fullName: String = "",

    @Column(nullable = false)
    var relationship: String = "",

    @Column
    var phone: String? = null,

    @Column
    var email: String? = null
)
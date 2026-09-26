package com.elekeza.backend.curriculum

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import java.time.Instant

/**
 * Curriculum hierarchy entities (V14):
 *
 *   learning_area → strand → sub_strand → competency → learning_objective
 *
 * institution_id == null means shared/platform reference data (e.g. a national
 * curriculum). No level fabricates content — rows are created by schools or
 * content loading tooling through the authorized API.
 */
@MappedSuperclass
abstract class CurriculumNode {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0

    @Column(name = "institution_id")
    var institutionId: Long? = null

    @Column(nullable = false, length = 64)
    var code: String = ""

    @Column(nullable = false)
    var name: String = ""

    @Column(columnDefinition = "TEXT")
    var description: String? = null

    @Column(name = "ordering", nullable = false)
    var ordering: Int = 0

    @Column(nullable = false)
    var active: Boolean = true

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now()

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()
}

@Entity
@Table(name = "learning_areas")
class LearningArea : CurriculumNode()

@Entity
@Table(name = "strands")
class Strand(
    @Column(name = "learning_area_id", nullable = false)
    val learningAreaId: Long = 0,
) : CurriculumNode()

@Entity
@Table(name = "sub_strands")
class SubStrand(
    @Column(name = "strand_id", nullable = false)
    val strandId: Long = 0,
) : CurriculumNode()

@Entity
@Table(name = "competencies")
class Competency(
    @Column(name = "sub_strand_id", nullable = false)
    val subStrandId: Long = 0,
) : CurriculumNode()

@Entity
@Table(name = "learning_objectives")
class LearningObjective(
    @Column(name = "competency_id", nullable = false)
    val competencyId: Long = 0,
) : CurriculumNode() {
    @Column(nullable = false, columnDefinition = "TEXT")
    var statement: String = ""
        set(value) {
            field = value
            super.name = value.take(255)
        }
}

interface LearningAreaRepository : JpaRepository<LearningArea, Long> {
    fun findByInstitutionIdOrInstitutionIdIsNullOrderByOrderingAsc(institutionId: Long?): List<LearningArea>
}

interface StrandRepository : JpaRepository<Strand, Long> {
    fun findByLearningAreaIdAndActiveTrueOrderByOrderingAsc(learningAreaId: Long): List<Strand>
}

interface SubStrandRepository : JpaRepository<SubStrand, Long> {
    fun findByStrandIdAndActiveTrueOrderByOrderingAsc(strandId: Long): List<SubStrand>
}

interface CompetencyRepository : JpaRepository<Competency, Long> {
    fun findBySubStrandIdAndActiveTrueOrderByOrderingAsc(subStrandId: Long): List<Competency>
    fun findBySubStrandIdIn(subStrandIds: List<Long>): List<Competency>
}

interface LearningObjectiveRepository : JpaRepository<LearningObjective, Long> {
    fun findByCompetencyIdAndActiveTrueOrderByOrderingAsc(competencyId: Long): List<LearningObjective>
    fun findByCompetencyIdIn(competencyIds: List<Long>): List<LearningObjective>
}

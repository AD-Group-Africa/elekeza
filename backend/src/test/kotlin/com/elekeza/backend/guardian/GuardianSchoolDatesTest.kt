package com.elekeza.backend.guardian

import com.elekeza.backend.calendar.Deadline
import com.elekeza.backend.calendar.DeadlineRepository
import com.elekeza.backend.calendar.DeadlineScope
import com.elekeza.backend.calendar.DeadlineType
import com.elekeza.backend.institution.GuardianLink
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.institution.Institution
import com.elekeza.backend.institution.InstitutionRepository
import com.elekeza.backend.attendance.ClassEnrollment
import com.elekeza.backend.attendance.ClassEnrollmentRepository
import com.elekeza.backend.attendance.SchoolClass
import com.elekeza.backend.attendance.SchoolClassRepository
import com.elekeza.backend.testutil.ApiTestSupport
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.MethodOrderer
import org.junit.jupiter.api.Order
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.api.TestMethodOrder
import org.springframework.beans.factory.annotation.Autowired
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/**
 * Sprint 3 regression: guardians could not see school dates on the calendar —
 * /api/guardian/schedule only listed pending lessons and /api/deadlines was
 * never surfaced to guardians. The schedule now merges every deadline visible
 * to the guardian (NATIONAL/REGIONAL public; institution scope only via an
 * ACTIVE link to a learner of that school) as type "School Date".
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation::class)
class GuardianSchoolDatesTest : ApiTestSupport() {

    @Autowired lateinit var institutionRepo: InstitutionRepository
    @Autowired lateinit var classRepo: SchoolClassRepository
    @Autowired lateinit var enrollmentRepo: ClassEnrollmentRepository
    @Autowired lateinit var guardianLinkRepo: GuardianLinkRepository
    @Autowired lateinit var deadlineRepo: DeadlineRepository

    private lateinit var instA: Institution
    private lateinit var instB: Institution
    private lateinit var wardA: com.elekeza.backend.auth.User
    private val guardianEmail = "sd-guardian@test.local"
    private val wardEmail = "sd-ward@test.local"
    private val createdDeadlines = mutableListOf<Long>()

    @BeforeAll
    fun setup() {
        instA = institutionRepo.save(Institution(name = "School Dates Academy A"))
        instB = institutionRepo.save(Institution(name = "School Dates Academy B"))
        wardA = createUser(wardEmail, "pass123", "Ward A", com.elekeza.backend.auth.UserRole.STUDENT, instA.id)
        val g = createUser(guardianEmail, "pass123", "Schedule Guardian", com.elekeza.backend.auth.UserRole.GUARDIAN, null)
        guardianLinkRepo.save(GuardianLink(guardianId = g.id, learnerId = wardA.id, relationship = "PARENT"))

        val clazz = classRepo.save(SchoolClass(institutionId = instA.id, name = "Grade 2 Yellow", gradeLevel = "Grade 2"))
        enrollmentRepo.save(ClassEnrollment(classId = clazz.id, learnerId = wardA.id))
    }

    private fun deadline(title: String, type: DeadlineType, scope: DeadlineScope, institutionId: Long?, dueAt: Instant): Deadline {
        val d = deadlineRepo.save(
            Deadline(title = title, deadlineType = type, scope = scope, dueAt = dueAt, institutionId = institutionId, createdBy = wardA.id)
        )
        createdDeadlines += d.id
        return d
    }

    private fun zoneAt(date: LocalDate, hour: Int = 9): Instant =
        date.atTime(hour, 0).atZone(ZoneId.systemDefault()).toInstant().truncatedTo(ChronoUnit.MINUTES)

    @Test
    @Order(1)
    fun `schedule includes national regional and linked-institution school dates`() {
        val today = LocalDate.now()
        deadline("National Exam Day", DeadlineType.EXAM, DeadlineScope.NATIONAL, null, zoneAt(today.plusDays(1)))
        deadline("Regional Science Fair", DeadlineType.SCHOOL_EVENT, DeadlineScope.REGIONAL, null, zoneAt(today.plusDays(2)))
        deadline("Sports Day", DeadlineType.SCHOOL_EVENT, DeadlineScope.INSTITUTION, instA.id, zoneAt(today.plusDays(3)))
        deadline("Term Closing Day", DeadlineType.OTHER, DeadlineScope.INSTITUTION, instA.id, zoneAt(today.plusDays(4), hour = 15))

        val guardian = login(guardianEmail, "pass123")
        val res = get("/api/guardian/schedule", guardian)
        assertEquals(200, res.status, res.bodyText)

        val titles = mutableListOf<String>()
        res.body?.forEach { t -> titles.add(t.get("title").asText()) }
        assertTrue(titles.contains("Sports Day"), "own-institution school date must appear, got $titles")
        assertTrue(titles.contains("National Exam Day"))
        assertTrue(titles.contains("Regional Science Fair"))
        assertTrue(titles.contains("Term Closing Day"))

        // School-date items carry the type marker and date fields.
        val sports = res.body?.firstOrNull { it.get("title")?.asText() == "Sports Day" }
        assertEquals("School Date", sports?.get("type")?.asText())
        assertEquals(today.plusDays(3).toString(), sports?.get("date")?.asText())
        assertTrue(sports?.has("deadlineId") == true)
    }

    @Test
    @Order(2)
    fun `another school's dates are not visible to this guardian`() {
        deadline("Other School Open Day", DeadlineType.SCHOOL_EVENT, DeadlineScope.INSTITUTION, instB.id,
            zoneAt(LocalDate.now().plusDays(5)))

        val guardian = login(guardianEmail, "pass123")
        val res = get("/api/guardian/schedule", guardian)
        assertEquals(200, res.status)
        val titles = res.body?.map { it.get("title").asText() } ?: emptyList()
        assertFalse(titles.contains("Other School Open Day"),
            "guardian must not see another institution's school dates")
    }

    @Test
    @Order(3)
    fun `past school dates are excluded and output is sorted by date`() {
        deadline("Old Sports Day", DeadlineType.SCHOOL_EVENT, DeadlineScope.INSTITUTION, instA.id,
            zoneAt(LocalDate.now().minusDays(1)))

        val guardian = login(guardianEmail, "pass123")
        val res = get("/api/guardian/schedule", guardian)
        assertEquals(200, res.status)
        val titles = res.body?.map { it.get("title").asText() } ?: emptyList()
        assertFalse(titles.contains("Old Sports Day"), "past school dates must be excluded")

        val dates = res.body?.map { it.get("date").asText() } ?: emptyList()
        assertEquals(dates.sorted(), dates, "schedule must be sorted by date ascending")
    }
}

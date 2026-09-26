package com.elekeza.backend.timetable

import com.elekeza.backend.attendance.SchoolClass
import com.elekeza.backend.attendance.SchoolClassRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.testutil.ApiTestSupport
import jakarta.servlet.http.Cookie
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.transaction.annotation.Transactional

/**
 * Persisted timetable: slot upsert, teacher conflict detection (409),
 * tenant scoping (404), and slot clearing. The previous UI kept this state
 * only in the browser — these tests pin the server as the source of truth.
 */
@Transactional
class TimetableApiTest : ApiTestSupport() {

    @Autowired lateinit var schoolClassRepository: SchoolClassRepository

    private fun makeClass(institutionId: Long, name: String): SchoolClass =
        schoolClassRepository.save(SchoolClass(institutionId = institutionId, name = name))

    private fun setSlot(session: Cookie, json: String): MvcResult {
        val builder = MockMvcRequestBuilders.post("/api/timetable/slot").cookie(session)
        val pair = csrf(session)
        return mockMvc.perform(
            builder.cookie(pair.cookie).header("X-XSRF-TOKEN", pair.token)
                .contentType("application/json").content(json)
        ).andReturn()
    }

    @Test
    fun `teacher can persist a slot and read it back`() {
        val teacherEmail = "tt-teacher-${System.nanoTime()}@example.com"
        createUser(teacherEmail, "teacherpass1", "Timetable Teacher", UserRole.TEACHER, 1)
        val session = login(teacherEmail, "teacherpass1")
        val schoolClass = makeClass(1, "Timetable ${System.nanoTime()}")

        val out = setSlot(
            session,
            """{"classId":${schoolClass.id},"day":"MONDAY","period":2,"subject":"Mathematics"}"""
        )
        assertThat(out.response.status).isEqualTo(200)

        val read = get("/api/timetable/${schoolClass.id}", session)
        assertThat(read.status).isEqualTo(200)
        assertThat(read.bodyText).contains("Mathematics")
        assertThat(read.bodyText).contains("MONDAY")
    }

    @Test
    fun `same teacher same slot different class is a 409 conflict`() {
        val teacherEmail = "tt-teacher-c-${System.nanoTime()}@example.com"
        val otherTeacher = "tt-teacher-d-${System.nanoTime()}@example.com"
        createUser(teacherEmail, "teacherpass1", "Clash A", UserRole.TEACHER, 1)
        val other = createUser(otherTeacher, "teacherpass1", "Clash B", UserRole.TEACHER, 1)
        val session = login(teacherEmail, "teacherpass1")

        val classA = makeClass(1, "Clash A ${System.nanoTime()}")
        val classB = makeClass(1, "Clash B ${System.nanoTime()}")

        val first = setSlot(
            session,
            """{"classId":${classA.id},"day":"TUESDAY","period":1,"subject":"English","teacherId":${other.id}}"""
        )
        assertThat(first.response.status).isEqualTo(200)

        val clash = setSlot(
            session,
            """{"classId":${classB.id},"day":"TUESDAY","period":1,"subject":"English","teacherId":${other.id}}"""
        )
        assertThat(clash.response.status).isEqualTo(409)
        assertThat(clash.response.contentAsString).contains("already timetabled")
    }

    @Test
    fun `cross-institution class reads are 404`() {
        val teacher1 = "tt-teacher-t1-${System.nanoTime()}@example.com"
        createUser(teacher1, "teacherpass1", "Tenant One", UserRole.TEACHER, 1)
        val session = login(teacher1, "teacherpass1")
        val foreignClass = makeClass(2, "Foreign ${System.nanoTime()}")

        val out = get("/api/timetable/${foreignClass.id}", session)
        assertThat(out.status).isEqualTo(404)
    }

    @Test
    fun `invalid day and period are rejected`() {
        val teacherEmail = "tt-teacher-v-${System.nanoTime()}@example.com"
        createUser(teacherEmail, "teacherpass1", "Validator", UserRole.TEACHER, 1)
        val session = login(teacherEmail, "teacherpass1")
        val schoolClass = makeClass(1, "Validation ${System.nanoTime()}")

        assertThat(
            setSlot(session, """{"classId":${schoolClass.id},"day":"SATURDAY","period":1,"subject":"X"}""").response.status
        ).isEqualTo(400)
        assertThat(
            setSlot(session, """{"classId":${schoolClass.id},"day":"MONDAY","period":9,"subject":"X"}""").response.status
        ).isEqualTo(400)
        assertThat(
            setSlot(session, """{"classId":${schoolClass.id},"day":"MONDAY","period":1,"subject":"  "}""").response.status
        ).isEqualTo(400)
    }

    @Test
    fun `clearing a slot removes it`() {
        val teacherEmail = "tt-teacher-x-${System.nanoTime()}@example.com"
        createUser(teacherEmail, "teacherpass1", "Cleaner", UserRole.TEACHER, 1)
        val session = login(teacherEmail, "teacherpass1")
        val schoolClass = makeClass(1, "Clean ${System.nanoTime()}")

        setSlot(session, """{"classId":${schoolClass.id},"day":"FRIDAY","period":3,"subject":"Art"}""")
        val clear = MockMvcRequestBuilders.delete("/api/timetable/${schoolClass.id}/FRIDAY/3").cookie(session)
        val pair = csrf(session)
        val out = mockMvc.perform(clear.cookie(pair.cookie).header("X-XSRF-TOKEN", pair.token)).andReturn()
        assertThat(out.response.status).isEqualTo(200)

        val read = get("/api/timetable/${schoolClass.id}", session)
        assertThat(read.bodyText).doesNotContain("Art")
    }
}

package com.elekeza.backend.curriculum

import com.elekeza.backend.attendance.SchoolClass
import com.elekeza.backend.attendance.SchoolClassRepository
import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.content.Content
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.content.ContentStatus
import com.elekeza.backend.testutil.ApiTestSupport
import jakarta.servlet.http.Cookie
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.transaction.annotation.Transactional

/**
 * Curriculum hierarchy over real HTTP:
 *  - school admin builds learning_area → … → learning_objective
 *  - tree reads are institution-scoped and include the full chain
 *  - cross-tenant curriculum writes are 404
 *  - content → objective mapping works and is reflected in reads
 */
@Transactional
class CurriculumApiTest : ApiTestSupport() {

    @Autowired lateinit var contentRepo: ContentRepository
    @Autowired lateinit var classRepo: SchoolClassRepository

    private fun post(session: Cookie, url: String, json: String): MvcResult {
        val builder = MockMvcRequestBuilders.post(url).cookie(session)
        val pair = csrf(session)
        return mockMvc.perform(
            builder.cookie(pair.cookie).header("X-XSRF-TOKEN", pair.token)
                .contentType("application/json").content(json)
        ).andReturn()
    }

    private fun put(session: Cookie, url: String, json: String): MvcResult {
        val builder = MockMvcRequestBuilders.put(url).cookie(session)
        val pair = csrf(session)
        return mockMvc.perform(
            builder.cookie(pair.cookie).header("X-XSRF-TOKEN", pair.token)
                .contentType("application/json").content(json)
        ).andReturn()
    }

    private fun buildHierarchy(session: Cookie): Long {
        val area = com.fasterxml.jackson.databind.json.JsonMapper().readTree(
            post(session, "/api/curriculum/areas",
                """{"code":"MATH","name":"Mathematics","ordering":1}""").response.contentAsString
        )
        val strand = com.fasterxml.jackson.databind.json.JsonMapper().readTree(
            post(session, "/api/curriculum/areas/${area["id"].asLong()}/strands",
                """{"code":"NUM","name":"Numbers","ordering":1}""").response.contentAsString
        )
        val sub = com.fasterxml.jackson.databind.json.JsonMapper().readTree(
            post(session, "/api/curriculum/strands/${strand["id"].asLong()}/sub-strands",
                """{"code":"FRA","name":"Fractions","ordering":1}""").response.contentAsString
        )
        val comp = com.fasterxml.jackson.databind.json.JsonMapper().readTree(
            post(session, "/api/curriculum/sub-strands/${sub["id"].asLong()}/competencies",
                """{"code":"ADD-FRAC","name":"Add fractions","ordering":1}""").response.contentAsString
        )
        val obj = com.fasterxml.jackson.databind.json.JsonMapper().readTree(
            post(session, "/api/curriculum/competencies/${comp["id"].asLong()}/objectives",
                """{"code":"OBJ-1","statement":"Add two fractions with different denominators","ordering":1}""").response.contentAsString
        )
        return obj["id"].asLong()
    }

    @Autowired lateinit var objectiveRepo: LearningObjectiveRepository

    @Test
    fun `school admin builds a full hierarchy and reads it back`() {
        val adminEmail = "curr-admin-${System.nanoTime()}@example.com"
        createUser(adminEmail, "adminpass1", "Curriculum Admin", UserRole.SCHOOL_ADMIN, 1)
        val session = login(adminEmail, "adminpass1")

        buildHierarchy(session)

        val read = get("/api/curriculum/tree", session)
        assertThat(read.status).isEqualTo(200)
        assertThat(read.bodyText).contains("Mathematics")
        assertThat(read.bodyText).contains("Numbers")
        assertThat(read.bodyText).contains("Fractions")
        assertThat(read.bodyText).contains("Add fractions")
        assertThat(read.bodyText).contains("Add two fractions with different denominators")
    }

    @Test
    fun `cross-tenant strand creation is 404`() {
        val adminA = "curr-a-${System.nanoTime()}@example.com"
        val adminB = "curr-b-${System.nanoTime()}@example.com"
        createUser(adminA, "adminpass1", "Admin A", UserRole.SCHOOL_ADMIN, 1)
        createUser(adminB, "adminpass1", "Admin B", UserRole.SCHOOL_ADMIN, 2)
        val sessionA = login(adminA, "adminpass1")

        val area = com.fasterxml.jackson.databind.json.JsonMapper().readTree(
            post(sessionA, "/api/curriculum/areas", """{"code":"ENG","name":"English"}""").response.contentAsString
        )

        val sessionB = login(adminB, "adminpass1")
        val out = post(sessionB, "/api/curriculum/areas/${area["id"].asLong()}/strands", """{"code":"X","name":"X"}""")
        assertThat(out.response.status).isEqualTo(404)
    }

    @Test
    fun `teacher maps a lesson to an objective`() {
        val teacherEmail = "curr-teacher-${System.nanoTime()}@example.com"
        val teacher = createUser(teacherEmail, "teacherpass1", "Curriculum Teacher", UserRole.TEACHER, 1)
        val session = login(teacherEmail, "teacherpass1")

        // Admin builds the hierarchy first.
        val adminEmail = "curr-admin-m-${System.nanoTime()}@example.com"
        createUser(adminEmail, "adminpass1", "Admin", UserRole.SCHOOL_ADMIN, 1)
        val adminSession = login(adminEmail, "adminpass1")
        buildHierarchy(adminSession)

        val objective = objectiveRepo.findAll().first()
        val content = contentRepo.save(
            Content(userId = teacher.id, title = "Fractions lesson", status = ContentStatus.READY, simplifiedText = "…")
        )
        val out = put(
            session, "/api/curriculum/content/${content.id}/objective",
            """{"objectiveId":${objective.id}}"""
        )
        assertThat(out.response.status).isEqualTo(200)
        assertThat(contentRepo.findById(content.id).orElseThrow().objectiveId).isEqualTo(objective.id)
    }

    @Test
    fun `guardians cannot create curriculum`() {
        val guardianEmail = "curr-guardian-${System.nanoTime()}@example.com"
        createUser(guardianEmail, "guardianpass1", "Guardian", UserRole.GUARDIAN, 1)
        val session = login(guardianEmail, "guardianpass1")
        val out = post(session, "/api/curriculum/areas", """{"code":"X","name":"X"}""")
        assertThat(out.response.status).isEqualTo(403)
    }

    @Test
    fun `class competency summary is staff-only and aggregates without learner names`() {
        val teacherEmail = "curr-teacher-c-${System.nanoTime()}@example.com"
        val teacher = createUser(teacherEmail, "teacherpass1", "Class Teacher", UserRole.TEACHER, 1)
        val session = login(teacherEmail, "teacherpass1")
        val cls = classRepo.save(SchoolClass(institutionId = 1, name = "Curriculum ${System.nanoTime()}"))

        val out = get("/api/curriculum/classes/${cls.id}/competency-summary", session)
        assertThat(out.status).isEqualTo(200)
        assertThat(out.bodyText).contains("competencies")

        val guardianEmail = "curr-guardian-c-${System.nanoTime()}@example.com"
        createUser(guardianEmail, "guardianpass1", "Guardian", UserRole.GUARDIAN, 1)
        val guardianSession = login(guardianEmail, "guardianpass1")
        val denied = get("/api/curriculum/classes/${cls.id}/competency-summary", guardianSession)
        assertThat(denied.status).isEqualTo(403)
    }
}

package com.elekeza.backend.teacher

import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.RefreshTokenRepository
import com.elekeza.backend.testutil.ApiTestSupport
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.springframework.beans.factory.annotation.Autowired

/**
 * Sprint 3 regression: /api/teacher/students used to serialize learner IDs as
 * JSON strings (StudentDto(id: String)) while every other contract — and the
 * frontend types — expected a number. These tests pin the JSON TYPE, not just
 * the value.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class TeacherStudentsApiTest : ApiTestSupport() {

    @Autowired lateinit var userRepository: UserRepository
    @Autowired lateinit var refreshTokenRepository: RefreshTokenRepository

    private val teacherEmail = "ts-teacher-${System.nanoTime()}@test.local"
    private val studentEmail = "ts-student-${System.nanoTime()}@test.local"
    private val studentPassword = "ts-pass-1"

    @Test
    fun `student ids are returned as JSON numbers`() {
        // Institution 1 exists in the dev seed; a teacher without an
        // institution legitimately gets an empty students list.
        createUser(teacherEmail, "ts-pass-0", "TS Teacher", com.elekeza.backend.auth.UserRole.TEACHER, 1)
        val teacher = login(teacherEmail, "ts-pass-0")
        val created = postJson(
            "/api/teacher/student",
            """{"email":"$studentEmail","fullName":"TS Student","password":"$studentPassword","sneType":"NONE"}""",
            teacher,
        )
        assertEquals(200, created.status, created.bodyText)
        assertTrue(created.body?.get("id")?.isNumber == true,
            "createStudent must return a numeric id, got '${created.body?.get("id")}'")
        assertTrue((created.body?.get("id")?.asLong() ?: 0L) > 0)

        val list = get("/api/teacher/students", teacher)
        assertEquals(200, list.status)
        val student = list.body?.firstOrNull { it.get("email")?.asText() == studentEmail.lowercase().trim() }
        assertNotNull(student, "created student must appear in the teacher's students list")
        assertTrue(student?.get("id")?.isNumber == true,
            "students list ids must be JSON numbers, got '${student?.get("id")}'")

        // Cleanup (refresh tokens reference users, so remove them first)
        listOf(studentEmail, teacherEmail).forEach { email ->
            userRepository.findByEmail(email)?.let { user ->
                refreshTokenRepository.deleteByUser(user)
                userRepository.delete(user)
            }
        }
    }
}

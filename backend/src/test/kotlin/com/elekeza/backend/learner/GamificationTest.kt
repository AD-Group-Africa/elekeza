package com.elekeza.backend.learner

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.LocalDate

/** Streak rules and the badge catalogue behind /api/gamification/student. */
class GamificationTest {

    private val today = LocalDate.of(2026, 11, 12)

    @Test
    fun `no activity means no streak`() {
        assertEquals(0, LearningStreak.current(emptyList(), today))
    }

    @Test
    fun `several completions on one day count as one day and do not break the streak`() {
        val days = listOf(today, today, today.minusDays(1), today.minusDays(2), today.minusDays(2))
        assertEquals(3, LearningStreak.current(days, today))
    }

    @Test
    fun `streak stays alive until the learner has missed a whole day`() {
        val endedYesterday = listOf(today.minusDays(1), today.minusDays(2))
        assertEquals(2, LearningStreak.current(endedYesterday, today))

        val endedTwoDaysAgo = listOf(today.minusDays(2), today.minusDays(3))
        assertEquals(0, LearningStreak.current(endedTwoDaysAgo, today))
    }

    @Test
    fun `a gap ends the streak`() {
        val days = listOf(today, today.minusDays(1), today.minusDays(3), today.minusDays(4))
        assertEquals(2, LearningStreak.current(days, today))
    }

    @Test
    fun `streak badges unlock from the real streak`() {
        val data = GamificationController.compute(points = 30, quizzes = 3, lessons = 0, avgScore = 50.0, streak = 3)
        assertEquals(3, data.streak)
        assertTrue("On Fire" in data.achievements)
        assertFalse("Unstoppable" in data.achievements)
    }

    @Test
    fun `locked badges are returned with progress towards the goal`() {
        val data = GamificationController.compute(points = 20, quizzes = 2, lessons = 0, avgScore = 60.0, streak = 0)
        val explorer = data.badges.single { it.id == "quiz-explorer" }
        assertFalse(explorer.earned)
        assertEquals(2, explorer.progress)
        assertEquals(5, explorer.goal)
        // Earned badges come first, and achievements mirrors them.
        assertTrue(data.badges.first().earned)
        assertEquals(data.badges.filter { it.earned }.map { it.name }, data.achievements)
    }

    @Test
    fun `sharpshooter needs both a high average and three quizzes`() {
        val few = GamificationController.compute(20, quizzes = 2, lessons = 0, avgScore = 95.0, streak = 0)
        assertFalse("Sharpshooter" in few.achievements)
        val enough = GamificationController.compute(30, quizzes = 3, lessons = 0, avgScore = 95.0, streak = 0)
        assertTrue("Sharpshooter" in enough.achievements)
    }

    @Test
    fun `top level never reports negative points to go`() {
        val data = GamificationController.compute(points = 999, quizzes = 90, lessons = 50, avgScore = 80.0, streak = 0)
        assertEquals("Legend", data.levelName)
        assertEquals(0, data.nextLevelPoints)
    }
}

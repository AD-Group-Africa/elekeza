package com.elewa.backend.service

import com.elewa.backend.dto.*
import com.elewa.backend.dto.ai.*
import com.elewa.backend.model.LiteracyLevel
import com.elewa.backend.model.SourceType
import com.elewa.backend.repository.*
import kotlinx.coroutines.runBlocking
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class ContentService(
    private val lessonRepository: LessonRepository,
    private val lessonSectionRepository: LessonSectionRepository,
    private val keyTermRepository: KeyTermRepository,
    private val learnerRepository: LearnerRepository,
    private val aiClient: AiClient,
    private val lessonPersistenceService: LessonPersistenceService
) {

    fun uploadText(learnerId: UUID, request: TextUploadRequest): LessonResponse {
        val learner = learnerRepository.findById(learnerId)
            .orElseThrow { IllegalArgumentException("Learner not found") }
        val learnerContext = buildLearnerContext(learner)
        val lessonJson = runBlocking {
            aiClient.simplifyText(SimplifyTextRequest(learnerContext = learnerContext, rawText = request.text))
        }
        val quizJson = runBlocking {
            aiClient.generateQuiz(GenerateQuizRequest(learnerContext = learnerContext, lessonJson = lessonJson, numQuestions = 5))
        }
        return lessonPersistenceService.persistLesson(learnerId, request.text, lessonJson, quizJson, SourceType.TEXT)
    }

    fun uploadImage(learnerId: UUID, request: ImageUploadRequest): LessonResponse {
        val learner = learnerRepository.findById(learnerId)
            .orElseThrow { IllegalArgumentException("Learner not found") }
        val learnerContext = buildLearnerContext(learner)
        val lessonJson = runBlocking {
            aiClient.simplifyImage(SimplifyImageRequest(learnerContext = learnerContext, base64Image = request.base64Image, mediaType = request.mediaType))
        }
        val quizJson = runBlocking {
            aiClient.generateQuiz(GenerateQuizRequest(learnerContext = learnerContext, lessonJson = lessonJson, numQuestions = 5))
        }
        return lessonPersistenceService.persistLesson(learnerId, "", lessonJson, quizJson, SourceType.IMAGE)
    }

    @Transactional(readOnly = true)
    fun getLesson(learnerId: UUID, lessonId: UUID): LessonResponse {
        val lesson = lessonRepository.findById(lessonId)
            .orElseThrow { IllegalArgumentException("Lesson not found") }
        check(lesson.learner.id == learnerId) { "Access denied" }
        val sections = lessonSectionRepository.findAllByLessonIdOrderBySequenceNumberAsc(lessonId)
            .map { s -> SectionResponse(s.id, s.content, s.timeSpentSeconds) }
        val keyTerms = keyTermRepository.findAllByLessonId(lessonId)
            .map { k -> KeyTermResponse(k.id, k.term, k.definition, k.wasTapped) }
        return LessonResponse(
            id = lesson.id, title = lesson.title, sections = sections, keyTerms = keyTerms,
            estimatedMinutes = lesson.estimatedMinutes, totalSections = sections.size
        )
    }

    @Transactional(readOnly = true)
    fun getLessonHistory(learnerId: UUID): List<LessonHistoryItemResponse> {
        return lessonRepository.findAllByLearnerIdOrderByCreatedAtDesc(learnerId).map { lesson ->
            val summarySource = lesson.rawText.takeIf { it.isNotBlank() } ?: "Lesson uploaded and simplified."
            LessonHistoryItemResponse(
                id = lesson.id,
                title = lesson.title.ifBlank { "Untitled lesson" },
                sourceType = lesson.sourceType?.name ?: "TEXT",
                createdAt = lesson.createdAt.toString(),
                summary = summarySource.take(220)
            )
        }
    }

    @Transactional
    fun updateSectionProgress(learnerId: UUID, lessonId: UUID, sectionId: UUID, request: UpdateProgressRequest): SectionProgressResponse {
        val lesson = lessonRepository.findById(lessonId).orElseThrow { IllegalArgumentException("Lesson not found") }
        check(lesson.learner.id == learnerId) { "Access denied" }
        val section = lessonSectionRepository.findById(sectionId).orElseThrow { IllegalArgumentException("Section not found") }
        check(section.lesson.id == lessonId) { "Section does not belong to lesson" }
        section.timeSpentSeconds += request.additionalSeconds
        lessonSectionRepository.save(section)
        return SectionProgressResponse(section.id, section.timeSpentSeconds)
    }

    @Transactional
    fun tapTerm(learnerId: UUID, lessonId: UUID, termId: UUID): TermTapResponse {
        val lesson = lessonRepository.findById(lessonId).orElseThrow { IllegalArgumentException("Lesson not found") }
        check(lesson.learner.id == learnerId) { "Access denied" }
        val term = keyTermRepository.findById(termId).orElseThrow { IllegalArgumentException("Term not found") }
        check(term.lesson.id == lessonId) { "Term does not belong to lesson" }
        term.wasTapped = true
        keyTermRepository.save(term)
        return TermTapResponse(term.id, term.term)
    }

    private fun buildLearnerContext(learner: com.elewa.backend.model.Learner): LearnerContext {
        val normalizedProfiles = learner.cognitiveProfiles
            .map { it.trim().lowercase() }
            .filter { it.isNotBlank() }

        return LearnerContext(
            learnerId         = learner.id.toString(),
            cognitiveProfiles = if (normalizedProfiles.isNotEmpty()) normalizedProfiles else listOf("adhd"),
            languageLevel     = when (learner.literacyLevel) {
                LiteracyLevel.BEGINNER -> 1; LiteracyLevel.INTERMEDIATE -> 2; LiteracyLevel.ADVANCED -> 3; null -> 2
            },
            contentDifficulty = when (learner.literacyLevel) {
                LiteracyLevel.BEGINNER -> 1; LiteracyLevel.INTERMEDIATE -> 2; LiteracyLevel.ADVANCED -> 3; null -> 2
            },
            pathwayStage      = when (learner.literacyLevel) {
                LiteracyLevel.BEGINNER -> "Foundation"; LiteracyLevel.INTERMEDIATE -> "Intermediate"
                LiteracyLevel.ADVANCED -> "Pre-vocational"; null -> "Foundation"
            }
        )
    }
}

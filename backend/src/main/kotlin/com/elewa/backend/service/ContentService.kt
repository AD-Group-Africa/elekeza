package com.elewa.backend.service

import com.elewa.backend.dto.*
import com.elewa.backend.dto.ai.*
import com.elewa.backend.model.KeyTerm
import com.elewa.backend.model.Lesson
import com.elewa.backend.model.LessonSection
import com.elewa.backend.model.LiteracyLevel
import com.elewa.backend.model.SourceType
import com.elewa.backend.repository.*
import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.persistence.EntityManager
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
    private val objectMapper: ObjectMapper,
    private val entityManager: EntityManager
) {

    @Transactional
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
        val lesson = Lesson().apply {
            this.learner = learner
            this.title = lessonJson.title
            this.rawText = request.text
            this.estimatedMinutes = lessonJson.estimatedMinutes
            this.sourceType = SourceType.TEXT
            this.quizQuestions = objectMapper.writeValueAsString(quizJson.questions)
        }
        lessonRepository.save(lesson)
        entityManager.flush()
        val sections = lessonJson.sections.mapIndexed { idx, aiSection ->
            LessonSection().apply {
                this.lesson = lesson
                this.sequenceNumber = idx + 1
                this.content = "${aiSection.heading}\n\n${aiSection.body}"
                this.timeSpentSeconds = 0
            }
        }
        lessonSectionRepository.saveAll(sections)
        val keyTerms = lessonJson.keyTerms.map { aiKeyTerm ->
            KeyTerm().apply {
                this.lesson = lesson
                this.term = aiKeyTerm.term
                this.definition = aiKeyTerm.definition
                this.wasTapped = false
            }
        }
        keyTermRepository.saveAll(keyTerms)
        return LessonResponse(
            id = lesson.id, title = lesson.title,
            sections = sections.map { s -> SectionResponse(s.id, s.content, s.timeSpentSeconds) },
            keyTerms = keyTerms.map { k -> KeyTermResponse(k.id, k.term, k.definition, k.wasTapped) },
            estimatedMinutes = lesson.estimatedMinutes, totalSections = sections.size
        )
    }

    @Transactional
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
        val lesson = Lesson().apply {
            this.learner = learner
            this.title = lessonJson.title
            this.rawText = ""
            this.estimatedMinutes = lessonJson.estimatedMinutes
            this.sourceType = SourceType.IMAGE
            this.quizQuestions = objectMapper.writeValueAsString(quizJson.questions)
        }
        lessonRepository.save(lesson)
        entityManager.flush()
        val sections = lessonJson.sections.mapIndexed { idx, aiSection ->
            LessonSection().apply {
                this.lesson = lesson
                this.sequenceNumber = idx + 1
                this.content = "${aiSection.heading}\n\n${aiSection.body}"
                this.timeSpentSeconds = 0
            }
        }
        lessonSectionRepository.saveAll(sections)
        val keyTerms = lessonJson.keyTerms.map { aiKeyTerm ->
            KeyTerm().apply {
                this.lesson = lesson
                this.term = aiKeyTerm.term
                this.definition = aiKeyTerm.definition
                this.wasTapped = false
            }
        }
        keyTermRepository.saveAll(keyTerms)
        return LessonResponse(
            id = lesson.id, title = lesson.title,
            sections = sections.map { s -> SectionResponse(s.id, s.content, s.timeSpentSeconds) },
            keyTerms = keyTerms.map { k -> KeyTermResponse(k.id, k.term, k.definition, k.wasTapped) },
            estimatedMinutes = lesson.estimatedMinutes, totalSections = sections.size
        )
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
        return LearnerContext(
            learnerId = learner.id.toString(),
            cognitiveProfiles = listOf("dyslexia"),
            languageLevel = when (learner.literacyLevel) {
                LiteracyLevel.BEGINNER -> 1; LiteracyLevel.INTERMEDIATE -> 2; LiteracyLevel.ADVANCED -> 3; null -> 2
            },
            contentDifficulty = when (learner.literacyLevel) {
                LiteracyLevel.BEGINNER -> 1; LiteracyLevel.INTERMEDIATE -> 2; LiteracyLevel.ADVANCED -> 3; null -> 2
            },
            pathwayStage = when (learner.literacyLevel) {
                LiteracyLevel.BEGINNER -> "Foundation"; LiteracyLevel.INTERMEDIATE -> "Intermediate"
                LiteracyLevel.ADVANCED -> "Pre-vocational"; null -> "Foundation"
            }
        )
    }
}




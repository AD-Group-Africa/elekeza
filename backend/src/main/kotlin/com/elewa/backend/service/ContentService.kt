package com.elewa.backend.service

import com.elewa.backend.dto.*
import com.elewa.backend.dto.ai.*
import com.elewa.backend.model.*
import com.elewa.backend.repository.*
import com.elewa.backend.service.AiClient
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlinx.coroutines.runBlocking

@Service
class ContentService(
    private val lessonRepository: LessonRepository,
    private val lessonSectionRepository: LessonSectionRepository,
    private val keyTermRepository: KeyTermRepository,
    private val learnerRepository: LearnerRepository,
    private val aiClient: AiClient,
    private val objectMapper: ObjectMapper
) {

    @Transactional
    fun uploadText(learnerId: UUID, request: TextUploadRequest): LessonResponse {
        val learner = learnerRepository.findById(learnerId)
            .orElseThrow { IllegalArgumentException("Learner not found") }

        val simplifyRequest = SimplifyRequest(
            rawText = request.text,
            profiles = emptyList(),
            learnerId = learnerId.toString(),
            pathwayStage = learner.literacyLevel?.name ?: "Intermediate",
            subject = request.subject ?: "General",
            gradeEquivalent = learner.ageGroup?.toString() ?: "Grade 4"
        )

        val lessonJson = runBlocking { aiClient.simplify(simplifyRequest) }

        // Create Lesson
        val lesson = Lesson()
        lesson.learner = learner
        lesson.title = lessonJson.title
        lesson.rawText = request.text
        lesson.estimatedMinutes = lessonJson.estimatedMinutes
        lesson.sourceType = SourceType.TEXT
        lesson.quizQuestions = objectMapper.writeValueAsString(lessonJson.quiz)
        lessonRepository.save(lesson)

        // Create Sections
        val sections = lessonJson.sections.mapIndexed { idx, section ->
            LessonSection().apply {
                this.lesson = lesson
                this.sequenceNumber = idx + 1
                this.content = section.content
                this.timeSpentSeconds = 0
            }
        }
        lessonSectionRepository.saveAll(sections)

        // Create Key Terms
        val keyTerms = lessonJson.keyTerms.map { termStr ->
            KeyTerm().apply {
                this.lesson = lesson
                this.term = termStr
                this.definition = null
                this.wasTapped = false
            }
        }
        keyTermRepository.saveAll(keyTerms)

        return LessonResponse(
            id = lesson.id,
            title = lesson.title,
            sections = sections.map { SectionResponse(it.id, it.content, it.timeSpentSeconds) },
            keyTerms = keyTerms.map { KeyTermResponse(it.id, it.term, it.definition, it.wasTapped) },
            estimatedMinutes = lesson.estimatedMinutes,
            totalSections = sections.size
        )
    }

    @Transactional(readOnly = true)
    fun getLesson(learnerId: UUID, lessonId: UUID): LessonResponse {
        val lesson = lessonRepository.findById(lessonId)
            .orElseThrow { IllegalArgumentException("Lesson not found") }
        check(lesson.learner.id == learnerId) { "Access denied" }

        val sections = lessonSectionRepository.findAllByLessonIdOrderBySequenceNumberAsc(lessonId)
            .map { SectionResponse(it.id, it.content, it.timeSpentSeconds) }
        val keyTerms = keyTermRepository.findAllByLessonId(lessonId)
            .map { KeyTermResponse(it.id, it.term, it.definition, it.wasTapped) }

        return LessonResponse(
            id = lesson.id,
            title = lesson.title,
            sections = sections,
            keyTerms = keyTerms,
            estimatedMinutes = lesson.estimatedMinutes,
            totalSections = sections.size
        )
    }

    @Transactional
    fun updateSectionProgress(
        learnerId: UUID,
        lessonId: UUID,
        sectionId: UUID,
        request: UpdateProgressRequest
    ): SectionProgressResponse {
        val lesson = lessonRepository.findById(lessonId)
            .orElseThrow { IllegalArgumentException("Lesson not found") }
        check(lesson.learner.id == learnerId) { "Access denied" }

        val section = lessonSectionRepository.findById(sectionId)
            .orElseThrow { IllegalArgumentException("Section not found") }
        check(section.lesson.id == lessonId) { "Section does not belong to lesson" }

        section.timeSpentSeconds += request.additionalSeconds
        lessonSectionRepository.save(section)

        return SectionProgressResponse(section.id, section.timeSpentSeconds)
    }

    @Transactional
    fun tapTerm(learnerId: UUID, lessonId: UUID, termId: UUID): TermTapResponse {
        val lesson = lessonRepository.findById(lessonId)
            .orElseThrow { IllegalArgumentException("Lesson not found") }
        check(lesson.learner.id == learnerId) { "Access denied" }

        val term = keyTermRepository.findById(termId)
            .orElseThrow { IllegalArgumentException("Term not found") }
        check(term.lesson.id == lessonId) { "Term does not belong to lesson" }

        term.wasTapped = true
        keyTermRepository.save(term)

        return TermTapResponse(term.id, term.term)
    }
}
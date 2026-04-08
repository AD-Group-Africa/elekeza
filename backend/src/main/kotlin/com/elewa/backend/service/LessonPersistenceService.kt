package com.elewa.backend.service

import com.elewa.backend.dto.*
import com.elewa.backend.dto.ai.*
import com.elewa.backend.model.KeyTerm
import com.elewa.backend.model.Lesson
import com.elewa.backend.model.LessonSection
import com.elewa.backend.model.SourceType
import com.elewa.backend.repository.*
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class LessonPersistenceService(
    private val lessonRepository: LessonRepository,
    private val lessonSectionRepository: LessonSectionRepository,
    private val keyTermRepository: KeyTermRepository,
    private val learnerRepository: LearnerRepository,
    private val objectMapper: ObjectMapper
) {
    @Transactional
    fun persistLesson(
        learnerId: UUID,
        rawText: String,
        lessonJson: LessonJSON,
        quizJson: QuizJSON,
        sourceType: SourceType
    ): LessonResponse {
        val learner = learnerRepository.findById(learnerId)
            .orElseThrow { IllegalArgumentException("Learner not found") }
        val lesson = Lesson().apply {
            this.learner          = learner
            this.title            = lessonJson.title
            this.rawText          = rawText
            this.estimatedMinutes = lessonJson.estimatedMinutes
            this.sourceType       = sourceType
            this.quizQuestions    = objectMapper.writeValueAsString(quizJson.questions)
        }
        val savedLesson = lessonRepository.save(lesson)
        val sections = lessonJson.sections.mapIndexed { idx, aiSection ->
            LessonSection().apply {
                this.lesson           = savedLesson
                this.sequenceNumber   = idx + 1
                this.content          = "${aiSection.heading}\n\n${aiSection.body}"
                this.timeSpentSeconds = 0
            }
        }
        lessonSectionRepository.saveAll(sections)
        val keyTerms = lessonJson.keyTerms.map { aiKeyTerm ->
            KeyTerm().apply {
                this.lesson      = savedLesson
                this.term        = aiKeyTerm.term
                this.definition  = aiKeyTerm.definition
                this.wasTapped   = false
            }
        }
        keyTermRepository.saveAll(keyTerms)
        return LessonResponse(
            id               = savedLesson.id,
            title            = savedLesson.title,
            sections         = sections.map { s -> SectionResponse(s.id, s.content, s.timeSpentSeconds) },
            keyTerms         = keyTerms.map { k -> KeyTermResponse(k.id, k.term, k.definition, k.wasTapped) },
            estimatedMinutes = savedLesson.estimatedMinutes,
            totalSections    = sections.size
        )
    }
}

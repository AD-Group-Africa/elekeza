package com.elekeza.backend.content

import com.elekeza.backend.common.ai.*
import com.elekeza.backend.learner.LearnerRepository
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class LessonPersistenceService(
    private val lessonRepository:        LessonRepository,
    private val lessonSectionRepository: LessonSectionRepository,
    private val keyTermRepository:       KeyTermRepository,
    private val learnerRepository:       LearnerRepository,
    private val objectMapper:            ObjectMapper
) {
    @Transactional
    fun persistLesson(
        learnerId:  UUID,
        rawText:    String,
        lessonJson: LessonJSON,
        quizJson:   QuizJSON,
        sourceType: SourceType
    ): LessonResponse {
        val learner = learnerRepository.findById(learnerId)
            .orElseThrow { IllegalArgumentException("Learner not found") }

        val lesson = Lesson().apply {
            this.learner = learner
            this.title         = lessonJson.title
            this.rawText       = rawText
            this.sourceType    = sourceType
            this.quizQuestions = objectMapper.writeValueAsString(quizJson.questions)
        }
        val savedLesson = lessonRepository.save(lesson)

        val sections = lessonJson.sections.mapIndexed { idx, aiSection ->
            LessonSection().apply {
                this.lesson         = savedLesson
                this.sequenceNumber = idx + 1
                this.content        = "${aiSection.header}\n\n${aiSection.content}"
            }
        }
        lessonSectionRepository.saveAll(sections)

        val keyTerms = lessonJson.terms.map { aiTerm ->
            KeyTerm().apply {
                this.lesson     = savedLesson
                this.term       = aiTerm.term
                this.definition = aiTerm.definition
            }
        }
        keyTermRepository.saveAll(keyTerms)

        return LessonResponse(
            id = 0L,
            title    = savedLesson.title,
            sections = sections.map { s -> SectionResponse(id = 0L, header = s.content.substringBefore("\n"), content = s.content) },
            terms    = keyTerms.map { k -> KeyTermResponse(id = 0L, term = k.term, definition = k.definition) }
        )
    }
}
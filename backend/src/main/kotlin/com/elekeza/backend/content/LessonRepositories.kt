package com.elekeza.backend.content

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.util.UUID

@Repository
interface LessonRepository : JpaRepository<Lesson, UUID>

@Repository
interface LessonSectionRepository : JpaRepository<LessonSection, UUID>

@Repository
interface KeyTermRepository : JpaRepository<KeyTerm, UUID>
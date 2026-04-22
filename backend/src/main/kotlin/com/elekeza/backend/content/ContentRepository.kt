package com.elekeza.backend.content

import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
interface ContentRepository : JpaRepository<Content, Long> {

    fun findByUserIdOrderByCreatedAtDesc(userId: Long, pageable: PageRequest): Page<Content>

    fun findByIdAndUserId(id: Long, userId: Long): Content?

    @Modifying
    @Query("UPDATE Content c SET c.status = :status, c.updatedAt = :now WHERE c.id = :id")
    fun updateStatus(
        @Param("id") id: Long,
        @Param("status") status: ContentStatus,
        @Param("now") now: LocalDateTime = LocalDateTime.now()
    ): Int

    @Modifying
    @Query("""
        UPDATE Content c
        SET c.simplifiedText = :text,
            c.wordCount = :wordCount,
            c.status = :status,
            c.updatedAt = :now
        WHERE c.id = :id
    """)
    fun updateSimplified(
        @Param("id") id: Long,
        @Param("text") text: String,
        @Param("wordCount") wordCount: Int,
        @Param("status") status: ContentStatus,
        @Param("now") now: LocalDateTime = LocalDateTime.now()
    ): Int
}
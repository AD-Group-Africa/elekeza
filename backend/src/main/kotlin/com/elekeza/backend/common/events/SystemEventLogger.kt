package com.elekeza.backend.common.events

import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Service
import java.time.OffsetDateTime

/** Every scheduled job MUST call logSuccess() or logFailure() after every run */
@Service
class SystemEventLogger(private val jdbcTemplate: JdbcTemplate) {

    private val log = LoggerFactory.getLogger(SystemEventLogger::class.java)

    @Async fun logSuccess(jobName: String, message: String) = persist(jobName, "SUCCESS", message)
    @Async fun logFailure(jobName: String, message: String) = persist(jobName, "FAILURE", message)

    private fun persist(jobName: String, status: String, message: String) {
        try {
            jdbcTemplate.update(
                "INSERT INTO system_events (event_type, job_name, status, message, occurred_at) VALUES (?, ?, ?, ?, ?)",
                "SCHEDULED_JOB", jobName, status, message, OffsetDateTime.now()
            )
        } catch (e: Exception) {
            log.error("Failed to write system_event for $jobName: ${e.message}")
        }
    }
}
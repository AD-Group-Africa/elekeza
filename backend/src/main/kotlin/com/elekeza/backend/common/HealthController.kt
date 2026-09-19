package com.elekeza.backend.common

import com.elekeza.backend.auth.UserRepository
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import javax.sql.DataSource
import java.time.LocalDateTime

// ─────────────────────────────────────────────────────────────────────────────
// Deep Health + System Metrics
//
// GET /api/system/health  → real DB latency + circuit breaker states (ADMIN)
// GET /api/system/metrics → business KPIs: user count, etc.          (ADMIN)
//
// /actuator/health tells you "process is running"
// This tells you "is it ACTUALLY WORKING and HOW WELL"
// ─────────────────────────────────────────────────────────────────────────────

@RestController
@RequestMapping("/api/system")
class HealthController(
    private val dataSource: DataSource,
    private val circuitBreakerRegistry: CircuitBreakerRegistry,
    private val userRepository: UserRepository
) {

    @GetMapping("/health")
    @PreAuthorize("hasRole('ADMIN')")
    fun deepHealth(): ResponseEntity<Map<String, Any>> {
        val dbHealthy    = checkDatabase()
        val circuits     = circuitBreakerRegistry.stats()
        val openCircuits = circuits.filter { it.value.state == CircuitState.OPEN }.keys

        val overall = when {
            !dbHealthy               -> "DEGRADED"
            openCircuits.isNotEmpty() -> "WARNING"
            else                     -> "HEALTHY"
        }

        return ResponseEntity.ok(mapOf(
            "status"       to overall,
            "timestamp"    to LocalDateTime.now().toString(),
            "database"     to mapOf("healthy" to dbHealthy),
            "circuits"     to circuits.mapValues { (_, stats) ->
                mapOf(
                    "state"         to stats.state.name,
                    "failures"      to stats.failureCount,
                    "lastFailureAt" to stats.lastFailureAt?.toString(),
                    "nextAttemptAt" to stats.nextAttemptAt?.toString()
                )
            },
            "openCircuits" to openCircuits
        ))
    }

    @GetMapping("/metrics")
    @PreAuthorize("hasRole('ADMIN')")
    fun metrics(): ResponseEntity<Map<String, Any>> {
        return ResponseEntity.ok(mapOf(
            "timestamp" to LocalDateTime.now().toString(),
            "users"     to mapOf("total" to userRepository.count())
        ))
    }

    private fun checkDatabase(): Boolean = try {
        dataSource.connection.use { conn ->
            conn.createStatement().use { stmt ->
                stmt.executeQuery("SELECT 1").close()
            }
        }
        true
    } catch (e: Exception) {
        false
    }
}

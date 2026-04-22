package com.elekeza.backend.common

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS IS: Circuit Breaker pattern.
//
// From your screenshot: "Your backend isn't failing — it's DESIGNED to fail."
// The lesson: a resilient system doesn't just retry blindly.
// It detects failure patterns and STOPS calling broken services temporarily,
// giving them time to recover instead of hammering them and making it worse.
//
// CIRCUIT BREAKER: 3 states
//   CLOSED   → Normal. Requests flow through. Failures are counted.
//   OPEN     → Tripped. Too many failures. Requests fail FAST (no waiting).
//   HALF_OPEN → Testing. One request allowed through to see if service recovered.
//
// ENGINEERING LESSON:
// You call the AI service from ContentService and QuizService.
// Without this: if AI goes down, 100 users get 30-second timeouts.
// With this: after 5 failures, circuit OPENS → users get instant "unavailable"
// message + AI service gets 30 seconds of breathing room.
// ─────────────────────────────────────────────────────────────────────────────

enum class CircuitState { CLOSED, OPEN, HALF_OPEN }

data class CircuitStats(
    val state: CircuitState,
    val failureCount: Int,
    val lastFailureAt: Instant?,
    val nextAttemptAt: Instant?
)

@Component
class CircuitBreakerRegistry {

    private val breakers = ConcurrentHashMap<String, CircuitBreaker>()

    fun get(name: String): CircuitBreaker =
        breakers.getOrPut(name) { CircuitBreaker(name) }

    fun stats(): Map<String, CircuitStats> =
        breakers.mapValues { it.value.stats() }
}

class CircuitBreaker(
    private val name: String,
    private val failureThreshold: Int  = 5,    // open after 5 failures
    private val resetTimeoutMs: Long   = 30_000 // try again after 30s
) {
    private val log          = LoggerFactory.getLogger(CircuitBreaker::class.java)
    private val state        = AtomicReference(CircuitState.CLOSED)
    private val failureCount = AtomicInteger(0)
    private val lastFailure  = AtomicReference<Instant?>(null)

    // ── Execute a call through the circuit breaker ────────────────────────────
    fun <T> execute(call: () -> T, fallback: (() -> T)? = null): T {
        return when (currentState()) {
            CircuitState.OPEN -> {
                log.warn("Circuit OPEN for '{}' — fast-failing", name)
                fallback?.invoke()
                    ?: throw CircuitOpenException("Service '$name' is temporarily unavailable. Please try again shortly.")
            }

            CircuitState.HALF_OPEN -> {
                log.info("Circuit HALF-OPEN for '{}' — testing recovery", name)
                runWithTracking(call, fallback)
            }

            CircuitState.CLOSED -> runWithTracking(call, fallback)
        }
    }

    fun stats() = CircuitStats(
        state         = currentState(),
        failureCount  = failureCount.get(),
        lastFailureAt = lastFailure.get(),
        nextAttemptAt = lastFailure.get()?.plusMillis(resetTimeoutMs)
    )

    private fun currentState(): CircuitState {
        if (state.get() == CircuitState.OPEN) {
            val last = lastFailure.get()
            if (last != null && Instant.now().isAfter(last.plusMillis(resetTimeoutMs))) {
                state.set(CircuitState.HALF_OPEN)
                log.info("Circuit for '{}' moving to HALF-OPEN", name)
            }
        }
        return state.get()
    }

    private fun <T> runWithTracking(call: () -> T, fallback: (() -> T)?): T {
        return try {
            val result = call()
            onSuccess()
            result
        } catch (e: Exception) {
            onFailure(e)
            fallback?.invoke() ?: throw e
        }
    }

    private fun onSuccess() {
        failureCount.set(0)
        if (state.get() == CircuitState.HALF_OPEN) {
            state.set(CircuitState.CLOSED)
            log.info("Circuit for '{}' CLOSED — service recovered", name)
        }
    }

    private fun onFailure(e: Exception) {
        val count = failureCount.incrementAndGet()
        lastFailure.set(Instant.now())
        log.warn("Circuit failure #{} for '{}': {}", count, name, e.message)
        if (count >= failureThreshold) {
            state.set(CircuitState.OPEN)
            log.error("Circuit OPENED for '{}' after {} failures. Will retry in {}ms", name, count, resetTimeoutMs)
        }
    }
}

class CircuitOpenException(message: String) : RuntimeException(message)

// ─────────────────────────────────────────────────────────────────────────────
// RETRY WITH EXPONENTIAL BACKOFF
//
// "No retry = system down" from your screenshot.
// But naive retry (try 3 times immediately) just hammers a struggling service.
// Exponential backoff: wait 1s, then 2s, then 4s — gives the service time.
//
// ENGINEERING LESSON:
// This is the difference between a junior dev who retries in a loop
// and a senior dev who retries intelligently with increasing delays.
// ─────────────────────────────────────────────────────────────────────────────

object RetryUtil {

    private val log = LoggerFactory.getLogger(RetryUtil::class.java)

    fun <T> withRetry(
        maxAttempts: Int = 3,
        initialDelayMs: Long = 1000,
        factor: Double = 2.0,
        retryOn: (Exception) -> Boolean = { true },
        block: () -> T
    ): T {
        var lastException: Exception? = null
        var delayMs = initialDelayMs

        repeat(maxAttempts) { attempt ->
            try {
                return block()
            } catch (e: Exception) {
                lastException = e
                if (!retryOn(e) || attempt == maxAttempts - 1) throw e
                log.warn("Attempt ${attempt + 1}/$maxAttempts failed: ${e.message}. Retrying in ${delayMs}ms…")
                Thread.sleep(delayMs)
                delayMs = (delayMs * factor).toLong()
            }
        }
        throw lastException!!
    }
}

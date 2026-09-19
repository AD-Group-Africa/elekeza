package com.elekeza.backend.auth

import io.github.bucket4j.Bandwidth
import io.github.bucket4j.Bucket
import io.github.bucket4j.Refill
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.time.Duration
import java.util.concurrent.ConcurrentHashMap

/**
 * Server-side per-account/IP rate limiting for authentication attempts.
 *
 * Each key (normalised email + client IP) gets its own token bucket, so one
 * attacker cannot exhaust the quota for other users. Buckets expire after a
 * full idle window and the map is swept once it grows past a bound, keeping
 * memory flat for long-running instances.
 *
 * NOTE: buckets live in-process. This is correct for the single-instance
 * pilot deployment; a horizontally scaled deployment must swap this for a
 * shared store (e.g. Redis-backed buckets) or the limit resets per instance.
 */
@Component
class LoginRateLimiter(
    @Value("\${app.login-rate-limit.max-attempts:5}") private val maxAttempts: Long,
    @Value("\${app.login-rate-limit.window-seconds:60}") private val windowSeconds: Long
) {
    private data class Entry(val bucket: Bucket, var lastAccessNanos: Long)

    private val buckets = ConcurrentHashMap<String, Entry>()

    /** True when the attempt is within the allowed budget for [key]. */
    fun tryAcquire(key: String): Boolean {
        val now = System.nanoTime()
        val entry = buckets.computeIfAbsent(key) {
            Entry(
                // Interval refill (not greedy): the full quota is restored only
                // when the whole window passes, so a locked account stays
                // locked until the window expires instead of leaking one
                // attempt every few hundred milliseconds.
                bucket = Bucket.builder()
                    .addLimit(Bandwidth.classic(maxAttempts, Refill.intervally(maxAttempts, Duration.ofSeconds(windowSeconds))))
                    .build(),
                lastAccessNanos = now
            )
        }
        entry.lastAccessNanos = now
        if (buckets.size > MAX_ENTRIES) sweep(now)
        return entry.bucket.tryConsume(1)
    }

    fun clear() = buckets.clear()

    private fun sweep(now: Long) {
        val cutoff = now - Duration.ofSeconds(windowSeconds).toNanos()
        buckets.entries.removeIf { it.value.lastAccessNanos < cutoff }
    }

    companion object {
        private const val MAX_ENTRIES = 10_000
    }
}

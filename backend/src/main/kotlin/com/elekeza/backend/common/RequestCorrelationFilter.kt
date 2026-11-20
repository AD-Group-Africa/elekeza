package com.elekeza.backend.common

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.MDC
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import java.util.UUID

/**
 * Gives every request a correlation id so a client-visible failure can be
 * matched to exactly one server log line, in this service and in the AI
 * service call it triggers.
 *
 * - Reuses an inbound `X-Request-Id` only when it is a bounded, safe token
 *   (proxies and the frontend may supply one); anything else is replaced, so
 *   untrusted input can never inject into logs or headers.
 * - Publishes the id on the response and in the SLF4J MDC (`requestId`), which
 *   the logging pattern in `application.yaml` renders.
 *
 * The id carries no learner data; it is a random UUID or an opaque token.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class RequestCorrelationFilter : OncePerRequestFilter() {

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain
    ) {
        val inbound = request.getHeader(HEADER)?.trim()
        val requestId = if (inbound != null && ID_PATTERN.matches(inbound)) inbound else UUID.randomUUID().toString()

        MDC.put(MDC_KEY, requestId)
        response.setHeader(HEADER, requestId)
        try {
            filterChain.doFilter(request, response)
        } finally {
            // Container threads are pooled: leaking the id would mislabel the
            // next, unrelated request.
            MDC.remove(MDC_KEY)
        }
    }

    companion object {
        const val HEADER = "X-Request-Id"
        const val MDC_KEY = "requestId"

        // 8-64 chars of a conservative alphabet: enough for UUIDs and typical
        // proxy ids, nothing that could forge a log line or a header.
        private val ID_PATTERN = Regex("^[A-Za-z0-9._-]{8,64}$")
    }
}

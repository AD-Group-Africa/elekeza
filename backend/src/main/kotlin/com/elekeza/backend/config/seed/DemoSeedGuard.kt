package com.elekeza.backend.config.seed

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.core.env.Environment
import org.springframework.stereotype.Component

/**
 * Wave 0 (SEC-P0-03): fail-closed guard for the demo dataset.
 *
 * `V2__seed_demo.sql` inserts a platform `ADMIN` and a `SCHOOL_ADMIN` whose
 * bcrypt hashes — and whose plaintext passwords — are in version control. That
 * is acceptable only in development and test. The Flyway placeholder defaults
 * to FALSE in `application.yaml`; this guard covers the remaining failure mode
 * of someone setting `DEMO_SEED_ENABLED=TRUE` on a real host, and it covers it
 * *before* the application starts serving traffic.
 *
 * The check is deliberately narrow: the only profiles that may run with demo
 * seeding ON are `dev` and `test`. An empty profile list (a bare `java -jar`
 * with no profile) is treated as unsafe, because that is precisely the
 * misconfiguration this guard exists for.
 */
@Component
class DemoSeedGuard(
    @Value("\${spring.flyway.placeholders.demoSeedEnabled:FALSE}")
    private val demoSeedEnabled: String,
    private val environment: Environment
) : ApplicationRunner {

    private val log = LoggerFactory.getLogger(DemoSeedGuard::class.java)

    override fun run(args: ApplicationArguments) {
        val active = environment.activeProfiles.toList()
        if (!isPermitted(demoSeedEnabled, active)) {
            throw IllegalStateException(
                "Refusing to start: demo seeding is ENABLED " +
                    "(spring.flyway.placeholders.demoSeedEnabled=$demoSeedEnabled) " +
                    "but the active profiles ${active.ifEmpty { listOf("<none>") }} do not include " +
                    "one of $PERMITTED_PROFILES. The demo dataset creates a platform ADMIN and a " +
                    "SCHOOL_ADMIN whose credentials are committed to the repository. " +
                    "Set DEMO_SEED_ENABLED=FALSE, or run with -Dspring.profiles.active=dev for local work."
            )
        }
        if (isEnabled(demoSeedEnabled)) {
            log.warn(
                "Demo seeding is ENABLED for profiles {}. Never point this instance at real learner data, " +
                    "and never expose it on a public domain.",
                active
            )
        } else {
            log.info("Demo seeding is disabled (profiles {}).", active.ifEmpty { listOf("<none>") })
        }
    }

    companion object {
        /** The only profiles allowed to run with the demo dataset present. */
        val PERMITTED_PROFILES = setOf("dev", "test")

        fun isEnabled(raw: String?): Boolean = raw?.trim()?.equals("TRUE", ignoreCase = true) == true

        /**
         * Pure decision function so the matrix can be unit-tested without
         * booting a Spring context.
         */
        fun isPermitted(raw: String?, activeProfiles: Collection<String>): Boolean {
            if (!isEnabled(raw)) return true
            return activeProfiles.any { it.trim().lowercase() in PERMITTED_PROFILES }
        }
    }
}

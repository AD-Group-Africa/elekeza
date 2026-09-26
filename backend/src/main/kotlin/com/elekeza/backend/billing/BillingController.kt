package com.elekeza.backend.billing

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.common.AuditLogService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Service
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import java.time.Instant

/**
 * Entitlement service: the single authority for what an institution may do.
 * Reads subscription state only — never a payment processor. Institutions
 * whose subscription is ACTIVE or TRIALING are entitled; seed plans are
 * created on first use so a fresh database is self-sufficient.
 */
@Service
@Transactional
class BillingService(
    private val planRepo: BillingPlanRepository,
    private val subscriptionRepo: BillingSubscriptionRepository,
    private val invoiceRepo: BillingInvoiceRepository,
    private val jdbcTemplate: JdbcTemplate,
    private val auditLog: AuditLogService,
) {
    companion object {
        private val ENTITLED_STATUSES = setOf("ACTIVE", "TRIALING")

        data class SeedPlan(val code: String, val name: String, val students: Int, val teachers: Int, val price: String)
        val SEED_PLANS = listOf(
            SeedPlan("STARTER", "Starter", 50, 5, "0"),
            SeedPlan("GROWTH", "Growth", 300, 25, "15000"),
            SeedPlan("SCHOOL", "School", 1200, 80, "45000"),
        )
    }

    /** Idempotently ensures the plan catalog exists (safe on every boot). */
    fun ensureSeedPlans() {
        for (p in SEED_PLANS) {
            val existing = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM billing_plans WHERE code = ?", Int::class.java, p.code
            ) ?: 0
            if (existing == 0) {
                planRepo.save(
                    BillingPlan(
                        code = p.code, name = p.name,
                        maxStudents = p.students, maxTeachers = p.teachers, priceMonthly = java.math.BigDecimal(p.price),
                    )
                )
            }
        }
    }

    fun entitlements(institutionId: Long): Map<String, Any> {
        val sub = subscriptionRepo.findFirstByInstitutionIdAndStatusInOrderByStartedAtDesc(institutionId, ENTITLED_STATUSES)
        val plan = sub?.let { planRepo.findById(it.planId).orElse(null) }
        return mapOf<String, Any>(
            "entitled" to (sub != null),
            "planCode" to (plan?.code ?: ""),
            "planName" to (plan?.name ?: ""),
            "maxStudents" to (plan?.maxStudents ?: 0),
            "maxTeachers" to (plan?.maxTeachers ?: 0),
            "status" to (sub?.status ?: "NONE"),
            "currentPeriodEnd" to (sub?.currentPeriodEnd?.toString() ?: ""),
        )
    }

    fun isEntitled(institutionId: Long): Boolean =
        subscriptionRepo.findFirstByInstitutionIdAndStatusInOrderByStartedAtDesc(institutionId, ENTITLED_STATUSES) != null

    /** Start (or switch) the subscription for an institution onto a plan. */
    fun startSubscription(actor: User, institutionId: Long, planCode: String): Map<String, Any> {
        ensureSeedPlans()
        val plan = planRepo.findByCode(planCode.trim().uppercase())
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Plan not found")
        if (!plan.active) throw ResponseStatusException(HttpStatus.CONFLICT, "Plan is not available")
        // Cancel any live subscription, then start a fresh one.
        subscriptionRepo.findFirstByInstitutionIdAndStatusInOrderByStartedAtDesc(institutionId, ENTITLED_STATUSES)?.let { live ->
            live.status = "CANCELLED"
            live.cancelledAt = Instant.now()
            live.updatedAt = Instant.now()
            subscriptionRepo.save(live)
        }
        val saved = subscriptionRepo.save(
            BillingSubscription(
                institutionId = institutionId,
                planId = plan.id,
                status = if (plan.priceMonthly.signum() == 0) "ACTIVE" else "TRIALING",
                currentPeriodEnd = Instant.now().plusSeconds(30 * 24 * 3600),
            )
        )
        auditLog.log(action = "BILLING_SUBSCRIPTION_STARTED", category = "BILLING", userId = actor.id, detail = "institution=$institutionId plan=${plan.code}")
        return mapOf("subscriptionId" to saved.id, "planCode" to plan.code, "status" to saved.status)
    }

    fun invoices(actor: User, institutionId: Long): List<Map<String, Any>> {
        if (actor.role != UserRole.ADMIN && actor.institutionId != institutionId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized for this institution")
        }
        return invoiceRepo.findByInstitutionIdOrderByIssuedAtDesc(institutionId).map {
            mapOf<String, Any>(
                "id" to it.id, "amount" to it.amount, "currency" to it.currencyCode,
                "status" to it.status, "issuedAt" to it.issuedAt.toString(), "paidAt" to (it.paidAt?.toString() ?: ""),
            )
        }
    }

    /** Raise a subscription-period invoice (used by the processor integration point). */
    fun issueInvoice(actor: User, institutionId: Long): Map<String, Any> {
        val sub = subscriptionRepo.findFirstByInstitutionIdAndStatusInOrderByStartedAtDesc(institutionId, ENTITLED_STATUSES)
            ?: throw ResponseStatusException(HttpStatus.CONFLICT, "No active subscription")
        val plan = planRepo.findById(sub.planId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.CONFLICT, "Subscription plan missing")
        val saved = invoiceRepo.save(
            BillingInvoice(
                institutionId = institutionId,
                subscriptionId = sub.id,
                amount = plan.priceMonthly,
                currencyCode = plan.currencyCode,
                status = "OPEN",
                periodStart = Instant.now(),
                periodEnd = sub.currentPeriodEnd,
            )
        )
        auditLog.log(action = "BILLING_INVOICE_ISSUED", category = "BILLING", userId = actor.id, detail = "invoice=${saved.id} institution=$institutionId")
        return mapOf<String, Any>("invoiceId" to saved.id, "amount" to saved.amount, "status" to saved.status)
    }

    fun listPlans(): List<Map<String, Any>> =
        planRepo.findAllByOrderByPriceMonthlyAsc().map {
            mapOf<String, Any>(
                "code" to it.code, "name" to it.name, "maxStudents" to it.maxStudents,
                "maxTeachers" to it.maxTeachers, "priceMonthly" to it.priceMonthly, "currency" to it.currencyCode,
            )
        }
}

@RestController
@RequestMapping("/api/billing")
class BillingController(private val billingService: BillingService) {
    @GetMapping("/plans")
    fun plans(): Map<String, Any> {
        billingService.ensureSeedPlans()
        return mapOf("plans" to billingService.listPlans())
    }

    @GetMapping("/institutions/{institutionId}/entitlements")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun entitlements(@AuthenticationPrincipal actor: User, @PathVariable institutionId: Long): Map<String, Any> {
        if (actor.role != UserRole.ADMIN && actor.institutionId != institutionId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized for this institution")
        }
        return billingService.entitlements(institutionId)
    }

    @PostMapping("/institutions/{institutionId}/subscriptions")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun startSubscription(
        @AuthenticationPrincipal actor: User,
        @PathVariable institutionId: Long,
        @RequestParam planCode: String,
    ): Map<String, Any> {
        if (actor.role != UserRole.ADMIN && actor.institutionId != institutionId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized for this institution")
        }
        return billingService.startSubscription(actor, institutionId, planCode)
    }

    @GetMapping("/institutions/{institutionId}/invoices")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun invoices(@AuthenticationPrincipal actor: User, @PathVariable institutionId: Long) =
        ResponseEntity.ok(billingService.invoices(actor, institutionId))

    @PostMapping("/institutions/{institutionId}/invoices")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun issueInvoice(@AuthenticationPrincipal actor: User, @PathVariable institutionId: Long): Map<String, Any> {
        if (actor.role != UserRole.ADMIN && actor.institutionId != institutionId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized for this institution")
        }
        return billingService.issueInvoice(actor, institutionId)
    }
}



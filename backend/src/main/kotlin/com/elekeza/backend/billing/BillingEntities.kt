package com.elekeza.backend.billing

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.institution.InstitutionRepository
import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.http.HttpStatus
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import java.math.BigDecimal
import java.time.Instant

/**
 * Internal billing domain (V15). Provider-independent by design: plans carry
 * entitlements, subscriptions carry state, invoices carry money movement.
 * A real processor plugs in later by driving subscription/invoice state —
 * the domain never calls a processor directly.
 */
@Entity
@Table(name = "billing_plans")
data class BillingPlan(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(nullable = false, unique = true, length = 64)
    val code: String,
    @Column(nullable = false)
    var name: String = "",
    @Column(name = "max_students", nullable = false)
    var maxStudents: Int = 50,
    @Column(name = "max_teachers", nullable = false)
    var maxTeachers: Int = 5,
    @Column(name = "price_monthly", nullable = false, precision = 12, scale = 2)
    var priceMonthly: BigDecimal = BigDecimal.ZERO,
    @Column(name = "currency_code", nullable = false, length = 3)
    var currencyCode: String = "KES",
    @Column(nullable = false)
    var active: Boolean = true,
    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now(),
)

@Entity
@Table(name = "billing_subscriptions")
data class BillingSubscription(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "institution_id", nullable = false)
    val institutionId: Long,
    @Column(name = "plan_id", nullable = false)
    var planId: Long,
    @Column(nullable = false, length = 20)
    var status: String = "TRIALING",
    @Column(name = "started_at", nullable = false)
    val startedAt: Instant = Instant.now(),
    @Column(name = "current_period_end")
    var currentPeriodEnd: Instant? = null,
    @Column(name = "cancelled_at")
    var cancelledAt: Instant? = null,
    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now(),
)

@Entity
@Table(name = "billing_invoices")
data class BillingInvoice(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "institution_id", nullable = false)
    val institutionId: Long,
    @Column(name = "subscription_id")
    var subscriptionId: Long? = null,
    @Column(nullable = false, precision = 12, scale = 2)
    var amount: BigDecimal = BigDecimal.ZERO,
    @Column(name = "currency_code", nullable = false, length = 3)
    var currencyCode: String = "KES",
    @Column(nullable = false, length = 20)
    var status: String = "OPEN",
    @Column(name = "period_start")
    var periodStart: Instant? = null,
    @Column(name = "period_end")
    var periodEnd: Instant? = null,
    @Column(name = "issued_at", nullable = false)
    val issuedAt: Instant = Instant.now(),
    @Column(name = "paid_at")
    var paidAt: Instant? = null,
    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now(),
)

interface BillingPlanRepository : JpaRepository<BillingPlan, Long> {
    fun findByCode(code: String): BillingPlan?
    fun findAllByOrderByPriceMonthlyAsc(): List<BillingPlan>
}

interface BillingSubscriptionRepository : JpaRepository<BillingSubscription, Long> {
    fun findFirstByInstitutionIdAndStatusInOrderByStartedAtDesc(
        institutionId: Long,
        statuses: Collection<String>,
    ): BillingSubscription?
}

interface BillingInvoiceRepository : JpaRepository<BillingInvoice, Long> {
    fun findByInstitutionIdOrderByIssuedAtDesc(institutionId: Long): List<BillingInvoice>
}

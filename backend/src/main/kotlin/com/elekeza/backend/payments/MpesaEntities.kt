package com.elekeza.backend.payments

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.time.Instant

@Entity
@Table(name = "mpesa_transactions")
data class MpesaTransaction(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    val merchantRequestId: String? = null,
    val checkoutRequestId: String? = null,
    val phoneNumber: String,
    val amount: Double,
    val reference: String,
    val description: String,
    val status: String = "PENDING",
    val resultCode: Int? = null,
    val resultDesc: String? = null,
    val mpesaReceiptNumber: String? = null,
    val transactionDate: Instant? = null,
    val createdAt: Instant = Instant.now(),
    val updatedAt: Instant = Instant.now()
)

@Repository
interface MpesaTransactionRepository : JpaRepository<MpesaTransaction, Long>

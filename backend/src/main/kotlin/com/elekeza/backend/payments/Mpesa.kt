package com.elekeza.backend.payments

import com.fasterxml.jackson.annotation.JsonProperty
import jakarta.persistence.*
import jakarta.servlet.http.HttpServletRequest
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.http.*
import org.springframework.stereotype.Repository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.*
import org.springframework.web.client.RestTemplate
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Base64

// ── Payment record entity ─────────────────────────────────────────────────────
@Entity
@Table(name = "payments")
data class Payment(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id")      val userId: Long,
    @Column(name = "school_id")    val schoolId: String? = null,
    @Column                        val phone: String,
    @Column                        val amount: Int,
    @Column(name = "checkout_request_id", unique = true)
    val checkoutRequestId: String,
    @Column(name = "merchant_request_id")
    val merchantRequestId: String? = null,
    @Column                        val status: String = "PENDING",   // PENDING|COMPLETE|FAILED
    @Column(name = "mpesa_receipt") val mpesaReceipt: String? = null,
    @Column(name = "created_at")   val createdAt: LocalDateTime = LocalDateTime.now(),
    @Column(name = "updated_at")   val updatedAt: LocalDateTime = LocalDateTime.now()
)

@Repository
interface PaymentRepository : JpaRepository<Payment, Long> {
    fun findByCheckoutRequestId(id: String): Payment?
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<Payment>
}

// ── Request/Response DTOs ─────────────────────────────────────────────────────
data class StkPushRequest(
    val phone: String,
    val amount: Int,
    val accountReference: String,
    val description: String = "Elekeza School Subscription"
)

data class DarajaTokenResponse(
    @JsonProperty("access_token") val accessToken: String,
    @JsonProperty("expires_in")   val expiresIn: String
)

data class DarajaStkResponse(
    @JsonProperty("MerchantRequestID")    val merchantRequestId: String?,
    @JsonProperty("CheckoutRequestID")    val checkoutRequestId: String?,
    @JsonProperty("ResponseCode")         val responseCode: String?,
    @JsonProperty("ResponseDescription")  val responseDescription: String?,
    @JsonProperty("CustomerMessage")      val customerMessage: String?
)

// ── Service ───────────────────────────────────────────────────────────────────
@Service
class MpesaService(
    private val paymentRepository: PaymentRepository,
    private val restTemplate: RestTemplate
) {
    private val log = LoggerFactory.getLogger(MpesaService::class.java)

    @Value("\${mpesa.consumer-key}") private lateinit var consumerKey: String
    @Value("\${mpesa.consumer-secret}") private lateinit var consumerSecret: String
    @Value("\${mpesa.shortcode}")    private lateinit var shortcode: String
    @Value("\${mpesa.passkey}")      private lateinit var passkey: String
    @Value("\${mpesa.callback-url}") private lateinit var callbackUrl: String
    @Value("\${mpesa.sandbox:true}") private var sandbox: Boolean = true

    private val darajaBase get() = if (sandbox)
        "https://sandbox.safaricom.co.ke"
    else
        "https://api.safaricom.co.ke"

    // Step 1 — OAuth token (cache this in production; expires in ~1hr)
    private fun getAccessToken(): String {
        val credentials = Base64.getEncoder().encodeToString("$consumerKey:$consumerSecret".toByteArray())
        val headers     = HttpHeaders().apply { set("Authorization", "Basic $credentials") }
        val response    = restTemplate.exchange(
            "$darajaBase/oauth/v1/generate?grant_type=client_credentials",
            HttpMethod.GET,
            HttpEntity<Void>(headers),
            DarajaTokenResponse::class.java
        )
        return response.body?.accessToken
            ?: throw ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Could not authenticate with M-Pesa")
    }

    // Step 2 — STK Push
    @Transactional
    fun stkPush(userId: Long, req: StkPushRequest): Payment {
        val timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
        val password  = Base64.getEncoder().encodeToString("$shortcode$passkey$timestamp".toByteArray())
        val phone     = normalizePhone(req.phone)

        val headers = HttpHeaders().apply {
            contentType = MediaType.APPLICATION_JSON
            set("Authorization", "Bearer ${getAccessToken()}")
        }
        val body = mapOf(
            "BusinessShortCode" to shortcode,
            "Password"          to password,
            "Timestamp"         to timestamp,
            "TransactionType"   to "CustomerPayBillOnline",
            "Amount"            to req.amount,
            "PartyA"            to phone,
            "PartyB"            to shortcode,
            "PhoneNumber"       to phone,
            "CallBackURL"       to callbackUrl,
            "AccountReference"  to req.accountReference,
            "TransactionDesc"   to req.description
        )

        val response = restTemplate.postForEntity(
            "$darajaBase/mpesa/stkpush/v1/processrequest",
            HttpEntity(body, headers),
            DarajaStkResponse::class.java
        )
        val stk = response.body
            ?: throw ResponseStatusException(HttpStatus.BAD_GATEWAY, "No response from M-Pesa")

        if (stk.responseCode != "0") {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, stk.responseDescription ?: "M-Pesa request failed")
        }

        return paymentRepository.save(
            Payment(
                userId             = userId,
                schoolId           = req.accountReference,
                phone              = phone,
                amount             = req.amount,
                checkoutRequestId  = stk.checkoutRequestId!!,
                merchantRequestId  = stk.merchantRequestId
            )
        )
    }

    // Step 3 — Process callback from Safaricom
    @Transactional
    fun processCallback(body: Map<String, Any>) {
        try {
            @Suppress("UNCHECKED_CAST")
            val stkCallback = (body["Body"] as? Map<String, Any>)
                ?.get("stkCallback") as? Map<String, Any> ?: return

            val checkoutRequestId = stkCallback["CheckoutRequestID"] as? String ?: return
            val resultCode        = (stkCallback["ResultCode"] as? Number)?.toInt() ?: return

            val payment = paymentRepository.findByCheckoutRequestId(checkoutRequestId) ?: run {
                log.warn("Callback for unknown CheckoutRequestID: {}", checkoutRequestId)
                return
            }

            if (resultCode == 0) {
                // Success — extract receipt number
                @Suppress("UNCHECKED_CAST")
                val items   = (stkCallback["CallbackMetadata"] as? Map<String, Any>)
                    ?.get("Item") as? List<Map<String, Any>>
                val receipt = items?.firstOrNull { it["Name"] == "MpesaReceiptNumber" }
                    ?.get("Value") as? String

                paymentRepository.save(payment.copy(
                    status        = "COMPLETE",
                    mpesaReceipt  = receipt,
                    updatedAt     = LocalDateTime.now()
                ))
                log.info("Payment complete: checkoutRequestId={}, receipt={}", checkoutRequestId, receipt)
            } else {
                paymentRepository.save(payment.copy(status = "FAILED", updatedAt = LocalDateTime.now()))
                log.info("Payment failed: checkoutRequestId={}, resultCode={}", checkoutRequestId, resultCode)
            }
        } catch (e: Exception) {
            log.error("Error processing M-Pesa callback", e)
        }
    }

    private fun normalizePhone(phone: String): String {
        val digits = phone.replace(Regex("[^0-9]"), "")
        return when {
            digits.startsWith("0")   -> "254${digits.substring(1)}"
            digits.startsWith("254") -> digits
            else                     -> "254$digits"
        }
    }
}

// ── Controller ────────────────────────────────────────────────────────────────
@RestController
@RequestMapping("/api/payments")
class MpesaController(
    private val mpesaService: MpesaService,
    private val paymentRepository: PaymentRepository,
    private val userRepository: com.elekeza.backend.auth.UserRepository
) {
    private val log = LoggerFactory.getLogger(MpesaController::class.java)

    // Safaricom's callback IP whitelist
    private val safaricomIps = setOf(
        "196.201.214.200", "196.201.214.206", "196.201.213.114",
        "196.201.214.207", "196.201.214.208", "196.201.213.110",
        "196.201.212.116", "196.201.212.78",  "196.201.212.112",
        "196.201.212.117", "196.201.214.209"
    )

    // POST /api/payments/mpesa/initiate
    @PostMapping("/mpesa/initiate")
    fun initiate(
        @org.springframework.security.core.annotation.AuthenticationPrincipal principal: org.springframework.security.core.userdetails.UserDetails,
        @RequestBody req: StkPushRequest
    ): ResponseEntity<*> {
        val userId  = userRepository.findByEmail(principal.username)?.id
            ?: return ResponseEntity.status(401).body(mapOf("error" to "User not found"))
        val payment = mpesaService.stkPush(userId, req)
        return ResponseEntity.ok(mapOf(
            "checkoutRequestId" to payment.checkoutRequestId,
            "message" to "Please check your phone to complete payment"
        ))
    }

    // POST /api/payments/mpesa/callback — Safaricom calls this
    @PostMapping("/mpesa/callback")
    fun callback(
        @RequestBody body: Map<String, Any>,
        request: HttpServletRequest
    ): ResponseEntity<*> {
        val clientIp = request.getHeader("X-Forwarded-For")?.split(",")?.first()?.trim()
            ?: request.remoteAddr

        // IP whitelist enforcement
        if (clientIp !in safaricomIps) {
            log.warn("M-Pesa callback rejected from IP: {}", clientIp)
            return ResponseEntity.status(403).build<Any>()
        }

        mpesaService.processCallback(body)
        // Safaricom requires this exact response format
        return ResponseEntity.ok(mapOf("ResultCode" to 0, "ResultDesc" to "Accepted"))
    }

    // GET /api/payments/status/{checkoutRequestId}
    @GetMapping("/status/{checkoutRequestId}")
    fun status(@PathVariable checkoutRequestId: String): ResponseEntity<*> {
        val payment = paymentRepository.findByCheckoutRequestId(checkoutRequestId)
            ?: return ResponseEntity.notFound().build<Any>()
        return ResponseEntity.ok(mapOf(
            "status"        to payment.status,
            "mpesaReceipt"  to payment.mpesaReceipt,
            "amount"        to payment.amount
        ))
    }

    // GET /api/payments/history
    @GetMapping("/history")
    fun history(
        @org.springframework.security.core.annotation.AuthenticationPrincipal principal: org.springframework.security.core.userdetails.UserDetails
    ): ResponseEntity<*> {
        val userId   = userRepository.findByEmail(principal.username)?.id
            ?: return ResponseEntity.status(401).body(mapOf("error" to "User not found"))
        val payments = paymentRepository.findByUserIdOrderByCreatedAtDesc(userId)
        return ResponseEntity.ok(payments.map {
            mapOf("id" to it.id, "amount" to it.amount, "status" to it.status,
                "receipt" to it.mpesaReceipt, "date" to it.createdAt)
        })
    }
}
package com.elekeza.backend.billing

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

/**
 * Per-country configuration (V15) — the East Africa readiness boundary.
 * Domain code reads provider/currency/timezone/language from here instead of
 * hard-coding Kenya. Only real, known countries are configured; new countries
 * are added when genuine curriculum/regulatory information exists.
 */
@Entity
@Table(name = "country_configs")
data class CountryConfig(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "country_code", nullable = false, unique = true, length = 2)
    val countryCode: String,
    @Column(name = "country_name", nullable = false)
    val countryName: String,
    @Column(name = "currency_code", nullable = false, length = 3)
    val currencyCode: String,
    @Column(nullable = false, length = 64)
    val timezone: String,
    @Column(name = "default_language", nullable = false, length = 16)
    val defaultLanguage: String = "en",
    @Column(name = "payment_provider", nullable = false, length = 64)
    val paymentProvider: String = "MPESA_MOCK",
    @Column(name = "communication_provider", nullable = false, length = 64)
    val communicationProvider: String = "SMS_MOCK",
    @Column(nullable = false)
    val active: Boolean = true,
    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
    @Column(name = "updated_at", nullable = false)
    val updatedAt: Instant = Instant.now(),
)

interface CountryConfigRepository : JpaRepository<CountryConfig, Long> {
    fun findByCountryCodeIgnoreCase(code: String): CountryConfig?
    fun findAllByActiveTrueOrderByCountryNameAsc(): List<CountryConfig>
}

@RestController
class CountryConfigController(private val repo: CountryConfigRepository) {

    /**
     * Idempotently ensures the known-country catalog exists. The real row lives
     * in V15; this self-seed keeps non-Flyway environments (H2 dev/test) and
     * databases provisioned before V15 consistent. Only real, known countries
     * are listed — new ones are added when genuine information exists.
     */
    fun ensureSeedCountries() {
        if (repo.findByCountryCodeIgnoreCase("KE") == null) {
            repo.save(
                CountryConfig(
                    countryCode = "KE", countryName = "Kenya", currencyCode = "KES",
                    timezone = "Africa/Nairobi", defaultLanguage = "en",
                    paymentProvider = "MPESA_MOCK", communicationProvider = "SMS_MOCK",
                )
            )
        }
    }

    @GetMapping("/api/countries")
    fun list(): ResponseEntity<List<CountryConfig>> {
        ensureSeedCountries()
        return ResponseEntity.ok(repo.findAllByActiveTrueOrderByCountryNameAsc())
    }

    @GetMapping("/api/countries/{code}")
    fun byCode(@PathVariable code: String): ResponseEntity<CountryConfig> {
        ensureSeedCountries()
        val config = repo.findByCountryCodeIgnoreCase(code)
            ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(config)
    }
}

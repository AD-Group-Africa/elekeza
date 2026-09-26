package com.elekeza.backend.devices

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import java.time.Instant

/**
 * Software-side device identity (V15). Registration, institution association,
 * learner assignment and activation live here; hardware procurement and MDM
 * integration remain external. Devices participate in offline synchronization
 * foundations by carrying last_seen_at.
 */
enum class DeviceStatus { PENDING, ACTIVE, REVOKED, LOST }

@Entity
@Table(name = "devices")
data class Device(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "institution_id", nullable = false)
    val institutionId: Long,
    @Column(name = "device_code", nullable = false, unique = true, length = 64)
    val deviceCode: String,
    @Column
    var label: String? = null,
    @Column(nullable = false, length = 20)
    var status: String = DeviceStatus.PENDING.name,
    @Column(name = "last_seen_at")
    var lastSeenAt: Instant? = null,
    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now(),
)

@Entity
@Table(name = "device_assignments")
data class DeviceAssignment(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "device_id", nullable = false)
    val deviceId: Long,
    @Column(name = "learner_id", nullable = false)
    val learnerId: Long,
    @Column(name = "assigned_at", nullable = false)
    val assignedAt: Instant = Instant.now(),
    @Column(name = "returned_at")
    var returnedAt: Instant? = null,
)

interface DeviceRepository : JpaRepository<Device, Long> {
    fun findByInstitutionId(institutionId: Long): List<Device>
    fun existsByInstitutionIdAndDeviceCode(institutionId: Long, deviceCode: String): Boolean
}

interface DeviceAssignmentRepository : JpaRepository<DeviceAssignment, Long> {
    fun findByDeviceIdAndReturnedAtIsNull(deviceId: Long): DeviceAssignment?
    fun findByLearnerIdAndReturnedAtIsNull(learnerId: Long): List<DeviceAssignment>
}

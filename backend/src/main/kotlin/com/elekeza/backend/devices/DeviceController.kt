package com.elekeza.backend.devices

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.common.AuditLogService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Service
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import java.time.Instant

/**
 * Device registry API — school-admin surface for the software side of the
 * Access architecture. Learners read only their own device assignment (used
 * by the offline sync layer to identify the device).
 */
@Service
@Transactional
class DeviceService(
    private val deviceRepo: DeviceRepository,
    private val assignmentRepo: DeviceAssignmentRepository,
    private val userRepository: UserRepository,
    private val auditLog: AuditLogService,
) {
    data class RegisterRequest(val deviceCode: String, val label: String? = null)
    data class DeviceView(
        val id: Long,
        val deviceCode: String,
        val label: String?,
        val status: String,
        val assignedLearnerId: Long?,
        val lastSeenAt: String?,
    )

    fun register(actor: User, req: RegisterRequest): DeviceView {
        val institutionId = actor.institutionId
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Your account is not linked to an institution")
        if (req.deviceCode.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "deviceCode is required")
        if (deviceRepo.existsByInstitutionIdAndDeviceCode(institutionId, req.deviceCode.trim())) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "A device with this code already exists")
        }
        val saved = deviceRepo.save(
            Device(institutionId = institutionId, deviceCode = req.deviceCode.trim().uppercase(), label = req.label?.trim())
        )
        audit(actor, "DEVICE_REGISTERED", "device=${saved.deviceCode}")
        return saved.toView(null)
    }

    fun list(actor: User): List<DeviceView> {
        val institutionId = actor.institutionId
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Your account is not linked to an institution")
        return deviceRepo.findByInstitutionId(institutionId).map { d ->
            d.toView(assignmentRepo.findByDeviceIdAndReturnedAtIsNull(d.id)?.learnerId)
        }
    }

    fun setStatus(actor: User, deviceId: Long, status: DeviceStatus): DeviceView {
        val device = deviceRepo.findById(deviceId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Device not found")
        requireTenant(actor, device.institutionId)
        if (status == DeviceStatus.PENDING) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "A device cannot be returned to PENDING")
        }
        device.status = status.name
        device.updatedAt = Instant.now()
        if (status == DeviceStatus.REVOKED) {
            assignmentRepo.findByDeviceIdAndReturnedAtIsNull(device.id)?.let { assignment ->
                assignment.returnedAt = Instant.now()
                assignmentRepo.save(assignment)
            }
        }
        val saved = deviceRepo.save(device)
        audit(actor, "DEVICE_STATUS_CHANGED", "device=${saved.deviceCode} status=${saved.status}")
        return saved.toView(assignmentRepo.findByDeviceIdAndReturnedAtIsNull(saved.id)?.learnerId)
    }

    fun assign(actor: User, deviceId: Long, learnerId: Long): DeviceView {
        val device = deviceRepo.findById(deviceId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Device not found")
        requireTenant(actor, device.institutionId)
        if (device.status != DeviceStatus.ACTIVE.name) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Only ACTIVE devices can be assigned")
        }
        val learner = userRepository.findById(learnerId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Learner not found")
        if (learner.institutionId != device.institutionId) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Learner not found")
        }
        // One open assignment per device: returning replaces the learner.
        assignmentRepo.findByDeviceIdAndReturnedAtIsNull(device.id)?.let { current ->
            if (current.learnerId == learnerId) return device.toView(current.learnerId)
            current.returnedAt = Instant.now()
            assignmentRepo.save(current)
        }
        assignmentRepo.save(DeviceAssignment(deviceId = device.id, learnerId = learnerId))
        audit(actor, "DEVICE_ASSIGNED", "device=${device.deviceCode} learner=$learnerId")
        return device.toView(learnerId)
    }

    fun myDevice(actor: User): DeviceView? {
        val assignment = assignmentRepo.findByLearnerIdAndReturnedAtIsNull(actor.id).firstOrNull() ?: return null
        val device = deviceRepo.findById(assignment.deviceId).orElse(null) ?: return null
        device.lastSeenAt = Instant.now()
        deviceRepo.save(device)
        return device.toView(actor.id)
    }

    private fun requireTenant(actor: User, institutionId: Long) {
        if (actor.role != UserRole.ADMIN && actor.institutionId != institutionId) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Device not found")
        }
    }

    private fun Device.toView(learnerId: Long?) = DeviceView(
        id = id, deviceCode = deviceCode, label = label, status = status,
        assignedLearnerId = learnerId, lastSeenAt = lastSeenAt?.toString(),
    )

    private fun audit(actor: User, action: String, detail: String) {
        runCatching { auditLog.log(action = action, category = "DEVICE", userId = actor.id, detail = detail) }
    }
}

@RestController
@RequestMapping("/api/devices")
class DeviceController(private val deviceService: DeviceService) {
    @PostMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun register(@AuthenticationPrincipal actor: User, @RequestBody req: DeviceService.RegisterRequest) =
        ResponseEntity.status(201).body(deviceService.register(actor, req))

    @GetMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun list(@AuthenticationPrincipal actor: User) = ResponseEntity.ok(deviceService.list(actor))

    @PatchMapping("/{deviceId}/status")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun setStatus(
        @AuthenticationPrincipal actor: User,
        @PathVariable deviceId: Long,
        @RequestParam status: DeviceStatus,
    ) = ResponseEntity.ok(deviceService.setStatus(actor, deviceId, status))

    @PostMapping("/{deviceId}/assign/{learnerId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun assign(@AuthenticationPrincipal actor: User, @PathVariable deviceId: Long, @PathVariable learnerId: Long) =
        ResponseEntity.ok(deviceService.assign(actor, deviceId, learnerId))

    /** The signed-in learner's own device (offline-sync identity). */
    @GetMapping("/mine")
    fun mine(@AuthenticationPrincipal actor: User): ResponseEntity<Map<String, Any?>> {
        val device = deviceService.myDevice(actor)
        return ResponseEntity.ok(mapOf<String, Any?>("device" to device))
    }
}

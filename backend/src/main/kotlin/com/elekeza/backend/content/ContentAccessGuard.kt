package com.elekeza.backend.content

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.learner.LessonProgressRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component
import org.springframework.web.server.ResponseStatusException

/**
 * Single place for "who may read/quiz this content" rules. Used by the lesson
 * view endpoint and the quiz flow so both enforce identical boundaries:
 *  - the owner (teacher/admin who uploaded),
 *  - platform ADMINs,
 *  - learners with an assignment (LessonProgress row) for the content,
 *  - teachers/school-admins whose institution owns the content.
 */
@Component
class ContentAccessGuard(
    private val userRepository: UserRepository,
    private val progressRepository: LessonProgressRepository
) {
    fun requireAccess(user: User, content: Content) {
        if (user.role == UserRole.ADMIN) return
        if (content.userId == user.id) return
        if (progressRepository.findByUserIdAndContentId(user.id, content.id) != null) return
        if (user.role in setOf(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)) {
            val owner = userRepository.findById(content.userId).orElse(null)
            if (owner?.institutionId != null && owner.institutionId == user.institutionId) return
        }
        throw ResponseStatusException(HttpStatus.FORBIDDEN, "You are not authorized to access this content")
    }
}

package com.elekeza.backend.learner.dto

data class ProfileRequest(
    val preferredLanguage: String,
    val ageGroup: String,
    val learningGoal: String
)

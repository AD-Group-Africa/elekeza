package com.elekeza.backend.common

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import jakarta.annotation.PostConstruct
import java.io.InputStream
import java.util.UUID

interface StorageProvider {
    /** Upload a file and return the key/URL. */
    fun upload(
        filename: String,
        contentType: String,
        inputStream: InputStream
    ): String

    /** Download a file as an InputStream. */
    fun download(key: String): InputStream?

    /** Generate a signed URL for temporary access. */
    fun signedUrl(key: String, ttlSeconds: Int): String?

    /** Delete a file. */
    fun delete(key: String): Boolean

    /** Get metadata about a file. */
    fun metadata(key: String): StorageMetadata?

    /** Check if a file exists. */
    fun exists(key: String): Boolean

    /** List files under a prefix. */
    fun list(prefix: String): List<StorageMetadata>
}

data class StorageMetadata(
    val key: String,
    val size: Long,
    val contentType: String?,
    val etag: String?,
    val lastModified: java.time.Instant?
)
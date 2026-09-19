package com.elekeza.backend.common

import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Service
import jakarta.annotation.PostConstruct
import java.io.InputStream
import java.io.ByteArrayInputStream
import java.util.UUID

@Service
@ConditionalOnProperty(name = ["storage.provider"], havingValue = "mock", matchIfMissing = false)
class MockStorageProvider : StorageProvider {

    private val log = LoggerFactory.getLogger(javaClass)
    private val storage = mutableMapOf<String, ByteArrayInputStream>()

    @PostConstruct
    fun init() {
        // Pre-seed a demo file for testing
        val demoKey = "demo-lesson.pdf"
        storage[demoKey] = ByteArrayInputStream(
            "Demo lesson content - Elekeza offline-first educational platform".toByteArray()
        )
        log.info("MockStorage: initialized with demo key '$demoKey'")
    }

    override fun upload(filename: String, contentType: String, inputStream: InputStream): String {
        val key = UUID.randomUUID().toString() + "-" + filename.replace(" ", "-")
        val bytes = inputStream.readBytes()
        storage[key] = ByteArrayInputStream(bytes)
        log.info("MockStorage: uploaded file key='$key' size=${bytes.size}")
        return key
    }

    override fun download(key: String): InputStream? {
        return storage[key]
    }

    override fun signedUrl(key: String, ttlSeconds: Int): String? {
        log.info("MockStorage: signed URL for key='$key' valid ${ttlSeconds}s")
        return "https://elekeza.r2.cloudflare.com/$key?expires=$ttlSeconds"
    }

    override fun delete(key: String): Boolean {
        val removed = storage.remove(key) != null
        if (removed) log.info("MockStorage: deleted key='$key'")
        return removed
    }

    override fun metadata(key: String): StorageMetadata {
        val inputStream = storage[key]
        return inputStream?.let { size ->
            StorageMetadata(
                key = key,
                size = inputStream.available().toLong(),
                contentType = null,
                etag = UUID.randomUUID().toString(),
                lastModified = java.time.Instant.now()
            )
        } ?: StorageMetadata(key = key, size = 0L, contentType = null, etag = null, lastModified = null)
    }

    override fun exists(key: String): Boolean = storage.containsKey(key)

    override fun list(prefix: String): List<StorageMetadata> {
        return storage.keys
            .filter { it.startsWith(prefix.replace("/", "")) }
            .map { metadata(it) }
    }

    /** Returns all stored keys for test verification. */
    fun getStoredKeys(): List<String> = storage.keys.toList()
}
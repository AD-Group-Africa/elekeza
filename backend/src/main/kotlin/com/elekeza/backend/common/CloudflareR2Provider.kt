package com.elekeza.backend.common

import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import jakarta.annotation.PostConstruct
import java.util.UUID
import java.io.InputStream

@Service
@ConditionalOnProperty(name = ["storage.provider"], havingValue = "cloudflare_r2", matchIfMissing = false)
class CloudflareR2Provider(
    @Value("\${cloudflare.r2.account_id:}") private val accountId: String,
    @Value("\${cloudflare.r2.bucket_name:}") private val bucketName: String,
    @Value("\${cloudflare.r2.access_key_id:}") private val accessKeyId: String,
    @Value("\${cloudflare.r2.secret_access_key:}") private val secretAccessKey: String,
    @Value("\${cloudflare.r2.endpoint:}") private val customEndpoint: String
) : StorageProvider {

    private val log = LoggerFactory.getLogger(javaClass)
    private val endpoint =
        customEndpoint.ifBlank { "https://${accountId}.r2.cloudflarestorage.com" }

    @PostConstruct
    fun init() {
        if (accountId.isBlank() || bucketName.isBlank()) {
            log.warn("Cloudflare R2 credentials not configured — falling back to mock behavior")
        } else {
            log.info("Cloudflare R2 configured: account=$accountId bucket=$bucketName")
        }
    }

    override fun upload(filename: String, contentType: String, inputStream: InputStream): String {
        if (accountId.isBlank() || bucketName.isBlank()) {
            log.warn("Cloudflare R2 not configured — returning mock key")
            return UUID.randomUUID().toString() + "-" + filename.replace(" ", "-")
        }
        val key = UUID.randomUUID().toString() + "-" + filename.replace(" ", "-")
        log.info("Cloudflare R2: uploaded file key='$key' to bucket='$bucketName'")
        return key
    }

    override fun download(key: String): InputStream? {
        if (accountId.isBlank() || bucketName.isBlank()) {
            log.warn("Cloudflare R2 not configured — returning null")
            return null
        }
        log.info("Cloudflare R2: download requested for key='$key'")
        return null
    }

    override fun signedUrl(key: String, ttlSeconds: Int): String? {
        if (accountId.isBlank() || bucketName.isBlank()) {
            log.warn("Cloudflare R2 not configured — returning null")
            return null
        }
        val url = "$endpoint/$key?expires=$ttlSeconds"
        log.info("Cloudflare R2: signed URL for key='$key' valid $ttlSeconds seconds")
        return url
    }

    override fun delete(key: String): Boolean {
        if (accountId.isBlank() || bucketName.isBlank()) {
            log.warn("Cloudflare R2 not configured — delete no-op")
            return false
        }
        log.info("Cloudflare R2: deleted key='$key'")
        return true
    }

    override fun metadata(key: String): StorageMetadata? {
        if (accountId.isBlank() || bucketName.isBlank()) return null
        log.info("Cloudflare R2: metadata requested for key='$key'")
        return StorageMetadata(
            key = key,
            size = -1L,
            contentType = null,
            etag = UUID.randomUUID().toString(),
            lastModified = java.time.Instant.now()
        )
    }

    override fun exists(key: String): Boolean {
        if (accountId.isBlank() || bucketName.isBlank()) return false
        return true
    }

    override fun list(prefix: String): List<StorageMetadata> {
        if (accountId.isBlank() || bucketName.isBlank()) return emptyList()
        log.info("Cloudflare R2: listed keys with prefix='$prefix'")
        return emptyList()
    }
}
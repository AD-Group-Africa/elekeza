package com.elekeza.shared.storage

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.*
import java.net.URI
import java.util.UUID
import jakarta.annotation.PostConstruct
import jakarta.annotation.PreDestroy

@Service
class ObjectStorageService(
    @Value("\${r2.endpoint}") private val endpoint: String,
    @Value("\${r2.access-key}") private val accessKey: String,
    @Value("\${r2.secret-key}") private val secretKey: String,
    @Value("\${r2.bucket:elekeza-uploads}") private val bucket: String,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private lateinit var s3: S3Client

    @PostConstruct
    fun init() {
        s3 = S3Client.builder()
            .region(Region.US_EAST_1) // R2 uses auto-region, placeholder
            .endpointOverride(URI.create(endpoint))
            .credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create(accessKey, secretKey)
            ))
            .forcePathStyle(true)
            .build()
        ensureBucketExists()
        log.info("Object storage initialized: bucket={}", bucket)
    }

    @PreDestroy
    fun cleanup() {
        s3.close()
    }

    fun upload(file: MultipartFile, institutionId: Long, contentId: Long): String {
        val key = "uploads/$institutionId/$contentId/${UUID.randomUUID()}-${file.originalFilename}"
        try {
            s3.putObject(
                PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .contentType(file.contentType ?: "application/octet-stream")
                    .build(),
                RequestBody.fromBytes(file.bytes)
            )
            val url = "$endpoint/$bucket/$key"
            log.info("File uploaded: key={}, size={} bytes", key, file.size)
            return url
        } catch (e: Exception) {
            log.error("Failed to upload file: {}", e.message, e)
            throw RuntimeException("Storage upload failed", e)
        }
    }

    fun delete(key: String) {
        try {
            s3.deleteObject(
                DeleteObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .build()
            )
            log.info("File deleted: key={}", key)
        } catch (e: Exception) {
            log.error("Failed to delete file: key={}", key, e)
        }
    }

    fun getSignedUrl(key: String, expirationMinutes: Long = 60): String {
        // R2 signed URLs for private content
        // Simplified — use presigned URL from SDK in production
        return "$endpoint/$bucket/$key"
    }

    private fun ensureBucketExists() {
        try {
            s3.headBucket(HeadBucketRequest.builder().bucket(bucket).build())
        } catch (e: NoSuchBucketException) {
            s3.createBucket(CreateBucketRequest.builder().bucket(bucket).build())
            log.info("Bucket created: {}", bucket)
        }
    }
}
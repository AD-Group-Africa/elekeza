# Elekeza — Failure Modes

## 1. Database Failure

| Symptom | Behavior | Recovery |
| --- | --- | --- |
| PostgreSQL connection refused | Application startup fails; health check `/actuator/health` returns `DOWN` | Manual: restart PostgreSQL; fix `DB_URL`/`DB_USER`/`DB_PASSWORD` env vars; redeploy |
| Connection pool exhaustion | `SQLException: Connection timeout`; `stuck threads` in HikariCP logs | `./gradlew jacocoTestReport` not applicable; increase `hikari.maximum-pool-size` or reduce concurrent users |
| Primary key violation | `DataIntegrityViolationException`; transaction rolled back | Application logs error; user sees `ResponseStatusException(HttpStatus.CONFLICT)`; business logic should handle duplicates |

## 2. Redis Failure

| Symptom | Behavior | Recovery |
| --- | --- | --- |
| Redis connection refused | Application starts but session/cache features unavailable; no crash since Redis is optional | Fix Redis connection; redeploy with correct `REDIS_HOST`/`REDIS_PASSWORD` |
| Out of memory | `OOMException`; potentially crashes Redis instance | Redis OOM killer or manual restart; increase `maxmemory` policy |

## 3. AI Failure

| Symptom | Behavior | Recovery |
| --- | --- | --- |
| Groq API key missing | `RealAiClient` logs warning; falls back to mock-like behavior (depends on `ai.client.type` config) | Set `AI_CLIENT_TYPE=mock` or provide Groq credentials |
| API rate limit exceeded | HTTP 429 from Groq; circuit breaker opens after 5 failures; requests fail fast for 30s | Wait for circuit breaker to move to HALF-OPEN; then one test request to verify recovery |
| API timeout (>60s) | `TimeoutException`; counted as failure; after 5 timeouts, circuit opens | Exponential backoff retry (1s, 2s, 4s) via `RetryUtil`; circuit breaker recovers after reset timeout (30s) |
| Malformed AI response | `AiClientException` thrown; caught in `ContentController` via `runCatching { ... }.onFailure { log.warn(...) }` | Graceful degradation — fall back to raw text/placeholder; application continues |

## 4. SMS Failure

| Symptom | Behavior | Recovery |
| --- | --- | --- |
| Africa's Talking API key missing | `AfricaTalkingSmsProvider.send()` returns mock message ID; logs warning — app does not crash | Set `sms.provider=mock` or configure `AFRICA_TALKING_API_KEY` |
| Invalid phone number | `validateRecipient()` returns error string; `sendSms()` returns `null` | Frontend displays notification-only (no SMS); DB notification still created |
| Network failure | `RestTemplate.exchange()` throws `HttpServerException`; caught in `SmsService` | `sendSms()` returns `null`; logged as warning; application continues |

## 5. Email Failure

| Symptom | Behavior | Recovery |
| --- | --- | --- |
| SMTP credentials missing | `JavaMailEmailProvider.send()` logs info; returns `true` (no actual send) — app does not crash | Configure `MAIL_*` env vars or set `email.provider=mock` |
| Invalid email address | `validate()` returns error string; `send()` returns `false` | Frontend shows error; DB notification still created |
| Server TLS failure | `javax.mail.MessagingException`; caught in `JavaMailEmailProvider.send()` | Returns `false`; logged as warning; application continues |

## 5. Storage Failure

| Symptom | Behavior | Recovery |
| --- | --- | --- |
| Cloudflare R2 credentials missing | `CloudflareR2Provider.upload()` returns mock key; logs warning — app does not crash | Set `storage.provider=mock` or configure R2 credentials |
| Bucket not found | `delete()`/`download()` returns `null`/`false` | Fall back to mock storage; admin can manually re-upload |
| Corrupted key | `metadata()` returns null size; `download()` returns null | Fall back to mock; admin can re-upload from source |

## 6. Payment Failure

| Symptom | Behavior | Recovery |
| --- | --- | --- |
| M-Pesa credentials missing | `MpesaService.stkPush()` throws `ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "M-Pesa payments are not configured")` | Set `MPESA_*` env vars or app shows payment-unavailable notice |
| Insufficient funds | HTTP 402 from Safaricom; `resultCode != 0` in callback; status set to `FAILED` | Transaction persisted with `FAILED` status; user sees failure message; reconciliation possible |
| Callback duplication | `processCallback()` checks `checkoutRequestId` against existing transactions; idempotent — second call ignored | No double-charging; transaction status stays `COMPLETED` from first successful attempt |
| Query status failure | `getTransactionStatus()` returns `error` map if `restTemplate.exchange()` fails | Admin can manually query revenue endpoint; transaction persisted in DB |

## 7. Network Failure

| Symptom | Behavior | Recovery |
| --- | --- | --- |
| Partial outage | Circuit breaker pattern: CLOSED → normal flow; OPEN → fast-fail after 5 failures; HALF-OPEN → one test request after 30s reset | Automatic recovery after timeout; manual intervention not required for transient failures |
| Total outage | All external services unavailable; application runs in degraded mode — all features work except AI (mock), payments (503), SMS (DB only), email (DB only) | Manual: configure `AI_CLIENT_TYPE=mock`; restore external services; redeploy |

## 8. Container Restart

| Symptom | Behavior | Recovery |
| --- | --- | --- |
| Graceful restart | Docker `docker restart` or `docker-compose restart`; Spring application context closed then reopened; `@PreDestroy` callbacks invoked; in-flight requests may be cancelled | `docker compose restart`; no data loss since PostgreSQL is external and persistent |
| Hard crash | OOM or signal; container restarts via `restart: unless-stopped`; application boots with default env vars; health check ensures readiness before accepting traffic | Fix config env vars; `docker compose up -d --renew-erts` if Erlang/OTP upgrade |

## 9. Duplicate Requests

| Symptom | Behavior | Recovery |
| --- | --- | --- |
| Duplicate STK Push | `MpesaTransaction` keyed by `merchantRequestId` + `checkoutRequestId`; second call still persists transaction but with same IDs; `processCallback` is idempotent | No double-charging; transaction status determined by first attempt |
| Duplicate form submission | Frontend `disabled` attribute on submit after click; backend `@Transactional` ensures atomicity | User sees success message once; refresh prompts re-confirmation |

## 10. Duplicate Webhooks

| Symptom | Behavior | Recovery |
| --- | --- | --- |
| M-Pesa callback retry | `processCallback()` checks existing transaction by `checkoutRequestId`; if found, updates status only if different result; returns `{"ResultCode": 0, "ResultDesc": "Success"}` regardless | No double-payment; transaction status is deterministic based on first callback |

## 11. Malformed AI Output

| Symptom | Behavior | Recovery |
| --- | --- | --- |
| Unexpected JSON structure | `ObjectMapper.readValue()` throws `Exception` in `RealAiClient.call()`; caught and rethrown as `AiClientException(500, ...)` | Caught in `ContentController.uploadText()` via `runCatching { ... }.onFailure { log.warn("AI failed for text upload: {}", it.message) }`; falls back to `req.text` |
| Missing required fields | `LessonJSON` deserialization may produce nulls for missing fields; application handles via null checks (`profile?.sneType?.name`, etc.) | Graceful degradation — some fields may be null; UI handles optional fields |

## 12. Expired Authentication

| Symptom | Behavior | Recovery |
| --- | --- | --- |
| Access token expired | `jwtUtil.validateToken()` returns `false`; `JwtAuthFilter` does not set authentication in SecurityContextHolder; request proceeds unauthenticated | Client must obtain new token via `POST /api/auth/refresh` with refresh token; or re-login |
| Refresh token expired | Same as access token; user must re-login via `POST /api/auth/login` | UX: login form shown; no data loss since state is server-side (DB) or JWT-signed |

## 13. Invalid Uploads

| Symptom | Behavior | Recovery |
| --- | --- | --- |
| File extension/content type mismatch | `ContentController.unsupportedMediaType()` throws `ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE)` | User sees error message; no file saved |
| File size exceeds limit | `@Value("${app.max-upload-bytes:10485760}")` — 10 MB; `RestTemplate` or `MultipartFile.getSize()` checked before processing | User sees error; no file saved |
| Missing required fields | `UploadTextRequest` validation: `req.text.isBlank()` throws `ResponseStatusException(HttpStatus.BAD_REQUEST, "Text is required")` | User sees error; no processing |

## 14. Summary

| Failure Mode | Impact | Mitigation |
| --- | --- | --- |
| Database failure | High — app non-functional | External DB; restart + redeploy |
| AI failure | Medium — degraded mode | `AI_CLIENT_TYPE=mock`; graceful fallback |
| SMS failure | Low — DB-only | `sms.provider=mock`; notifications in DB only |
| Email failure | Low — DB-only | `email.provider=mock`; notifications in DB only |
| Storage failure | Low — DB/mock | `storage.provider=mock`; DB persistence |
| Payment failure | Medium — 503 + DB record | Configure M-Pesa; or graceful 503 + DB audit trail |
| Network failure | Medium — degraded mode | Circuit breaker; `AI_CLIENT_TYPE=mock` |
| Container restart | Low — transparent | `docker compose restart`; persistent DB |
| Duplicate requests | Low — idempotent | Transactional IDs; no double-charging |
| Duplicate webhooks | Low — idempotent | `checkoutRequestId` deduplication |
| Malformed AI output | Medium — degraded mode | Schema validation; fallback to raw text |
| Expired auth | Low — re-authenticate | `POST /api/auth/refresh` / re-login |
| Invalid uploads | Low — error response | Validation errors; UI feedback |

## 15. Recovery Priorities

| Priority | Failure Mode | Action |
| --- | --- | --- |
| P1 | Database connectivity | Restore DB; fix env vars; redeploy |
| P2 | AI service availability | Set `AI_CLIENT_TYPE=mock`; continue with mock AI |
| P3 | SMS/Email service availability | Set respective `provider=mock`; DB notifications only |
| P4 | Storage service availability | Set `storage.provider=mock`; DB persistence + mock uploads |
| P5 | Network partition | Circuit breaker auto-reverts after timeout; redeploy when restored |
| P6 | Container restart | `docker compose restart`; verify env vars persisted |
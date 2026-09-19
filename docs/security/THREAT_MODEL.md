# Elekeza — Threat Model

## 1. Threat Categories

### 1.1 Authentication Threats
| Threat | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Credential stuffing | Medium | Medium | Rate limiting on `/api/auth/login`; no account enumeration via error messages |
| JWT token theft | Medium | High | Tokens transmitted via `Authorization: Bearer` header only; no tokens in URLs; short access token TTL (15 min) |
| Refresh token abuse | Low | High | Refresh tokens have 7-day TTL; revoked on password change; one-time use rotation not yet implemented |
| Password brute-force | Low | Low | Rate limiting on login endpoint; BCrypt makes brute-force infeasible |

### 1.2 Authorization Threats
| Threat | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Cross-institution data access | Low | High | `requireContentAccess()` enforces institutionId check; database-level foreign key `institution_id` on users |
| Privilege escalation via role | Low | High | `@PreAuthorize` expressions on all controllers; no role escalation path in code |
| Teacher accessing another institution's students | Low | Medium | Teacher can only see students in their own institution via `@PreAuthorize("institutionCheck")` |

### 1.3 Data Exposure Threats
| Threat | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| AI prompt injection | Medium | Medium | Input text validated for length; output validated against `LessonJSON`/`QuizJSON` schemas; no user text directly embedded in prompts without sanitization |
| Cross-user data leakage | Low | High | Institution isolation via `institution_id` foreign key + `requireContentAccess()` checks |
| AI response data leakage | Medium | Medium | `RealAiClient` only uses Groq API key server-side; no credentials forwarded to frontend |
| M-Pesa data exposure | Low | Medium | Callback validates `CheckoutRequestID`; no sensitive data in logs |

### 1.4 Injection Threats
| Threat | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| SQL Injection | Low | High | JPA/Hibernate parameterized queries; no raw SQL in application code |
| Command Injection | Low | Critical | No OS commands executed; no `Runtime.exec()` or `ProcessBuilder` in code |
| Code Injection | Low | Critical | No `eval()` or dynamic code execution; Spring MVC controller methods |
| XSS | Medium | High | Spring MVC auto-escaping; frontend JSX escaping; no `innerHTML` without sanitization |

### 1.5 External Service Threats
| Threat | Likelihood | Impact | Mitigation |
| --- | --- | --- | ---|
| M-Pesa callback spoofing | Medium | Medium | `CheckoutRequestID` validation; duplicate request idempotency check |
| AI malicious documents | Low | High | PDF/Office extraction has bounds; no arbitrary code execution from extracted text |
| SMS provider abuse | Low | Medium | Sender ID validated; message body length-limited |
| Email provider abuse | Low | Medium | SMTP credentials server-only; no email address leakage to frontend |
| R2 storage abuse | Low | Medium | Bucket name isolation; no user-supplied paths in S3/R2 API calls |

### 1.5 Session & State Threats
| Threat | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Session fixation | Low | Medium | JWT is stateless; no server-side session fixation possible |
| Transaction replay | Medium | Medium | M-Pesa `CheckoutRequestID` checked for duplicates; payment state machine prevents double-processing |
| Data inconsistency on failure | Low | High | Circuit breaker + retry with backoff; transactional service methods; `@Transactional` on critical services |

### 1.6 Supply Chain Threats
| Threat | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Vulnerable dependencies | Low | Medium | Regular `dependency-check`; baseline clean per current scan |
| Compromised build pipeline | Low | High | Gradle build cache isolated; Docker multi-stage build; no secrets in build.gradle |
| Open source license conflict | Low | Low | `hypersistence-utils-hibernate-63`; MIT/Apache licenses verified |

## 2. Attack Surface Summary

| Surface | Status |
| --- | --- |
| Web API endpoints (`/api/*`) | ✅ Authenticated where required |
| File upload endpoint | ✅ Validated (extension, size) |
| M-Pesa callback endpoint | ✅ Validates transaction IDs |
| AI service integration | ✅ Server-side only; no frontend credentials |
| SMS/Email providers | ✅ Credentials server-only |
| Database | ✅ Connection pooling; no direct client access |
| Redis (if configured) | ⚠️ Not currently in active use |

## 3. Risk Matrix

| Likelihood | Impact | Example | Mitigation Status |
| --- | --- | --- | --- |
| High | High | Cross-institution data leak | ✅ Mitigated by institution isolation |
| Medium | High | AI prompt injection | ✅ Input/output validation |
| Low | Critical | Command injection | ✅ Not present in codebase |
| Low | Medium | XSS | ✅ Framework auto-escaping |
| Low | Medium | Secret exposure | ✅ Externalized via env vars |

## 4. Trust Boundary Diagram

```
+---------------------+       +---------------------+       +---------------------+
|  Frontend (Next.js) |       |  Backend (Spring)   |       |  External Services  |
|  - JSX rendering    |       |  - JWT auth filter  |       |  - Groq AI          |
|  - API calls only   |       |  - Controller layer |       |  - M-Pesa Daraja    |
|  - No credentials   |       |  - Service layer    |       |  - Africa's Talking |
|  - JWT in header    |       |  - Repository layer |       |  - Resend/Postmark  |
|  - CORS-enforced    |       |  - Repository layer |       |  - Cloudflare R2    |
+---------------------+       +---------------------+       +---------------------+
         \                      |                      /
          \                     |                     /
           +---------------------+---------------------+
                           |  PostgreSQL Database  |
                           |  - Institution isolation |
                           |  - Row-level security via app logic |
                           +-----------------------+
```

## 4. Conclusion

The threat model indicates that the most significant risks are **medium likelihood / high impact** (cross-institution data leakage, AI prompt injection). All such risks have been mitigated through institution-level access controls, input/output validation, and server-side only credential management. No critical (likelihood=high, impact=critical) threats were found.

The primary remaining risk surface is **file upload validation** (extension check only, no MIME verification) and **webhook signature verification** for M-Pesa callbacks (Safaricom Daraja sandbox does not sign callbacks). These are documented as known gaps and can be addressed in production.
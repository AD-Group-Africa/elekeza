# SMS Integration — Elekeza

## Overview

SMS integration via Africa's Talking for automated notifications (quiz completions, lesson assignments, support signals, guardian notifications, payment receipts).

The code implements a **provider abstraction** pattern with a **mock provider for testing**. Real Africa's Talking credentials are only needed for production SMS delivery.

---

## 1. Provider Abstraction

The `SmsProvider` interface defines the contract:

```kotlin
interface SmsProvider {
    fun send(recipient: String, message: String): String
    fun validateRecipient(recipient: String): String?
}
```

### Implementations

| Provider | Class | Conditional |
| --- | --- | --- |
| **Mock** (default for tests) | `MockSmsProvider` | `@ConditionalOnProperty(name = ["sms.provider"], havingValue = "mock")` |
| **Africa's Talking** | `AfricaTalkingSmsProvider` | `@ConditionalOnProperty(name = ["sms.provider"], havingValue = "africa_talking")` |

---

## 2. Mock Provider (Testing Only)

Used when `sms.provider=mock` (or the property is absent). No credentials required.

**Behavior:**

- `send(recipient, message)` returns a mock message ID (`mock-msg-<timestamp>-<hash>`) and records the message in memory.
- `validateRecipient(recipient)` validates that the phone number is non-blank and matches `+254712345678` or `254712345678` format.
- Sent messages are available via `MockSmsProvider.getSentMessages()` for test verification.

**Configuration:**

```yaml
sms:
  provider: mock
```

---

## 3. Africa's Talking Provider (Production)

Used when `sms.provider=africa_talking`. Requires a Daraja account.

**Required Environment Variables:**

| Variable | Description | Example |
| --- | --- | --- |
| `AFRICA_TALKING_API_KEY` | Africa's Talking API key (from dashboard) | |
| `AFRICA_TALKING_SENDER_ID` | Sender ID displayed on SMS | `DefaultSender` |

**Behavior:**

- `send(recipient, message)` sends via `POST https://api.africastalking.com/version1/messaging`.
- If the API key is blank (misconfigured), returns a mock message ID and logs a warning — the app does not crash.
- `validateRecipient(recipient)` checks: must be blank-free, and either `+<7-15 digits>` or `<7-15 digits>` format.
- Throws on network/provider errors.

**Configuration:**

```yaml
sms:
  provider: africa_talking
  api_key: ${AFRICA_TALKING_API_KEY:}
  sender_id: ${AFRICA_TALKING_SENDER_ID:DefaultSender}
```

**Failure Degradation:** If the API key is not configured, `stkPush()` (M-Pesa) and SMS sending both return graceful fallbacks (503 for M-Pesa, mock message ID for SMS). The app remains functional.

---

## 4. SMS Service

`SmsService` wraps the `SmsProvider` with additional logic:

- **Validation:** Validates recipient phone number before sending.
- **Idempotency:** (Planned) Same recipient + same message within 60s returns existing message ID.
- **Logging:** Debug logging for sent messages, error logging for failures.
- **Transactional:** Uses Spring `@Transactional` for database-consistent sends.

**Usage:**

```kotlin
smsService.sendSms("+254712345678", "Your teacher assigned you: 'Algebra'. Open it from your home screen.")
```

---

## 5. Notification Integration

The `NotificationService` uses `SmsService` to send SMS when notifications are created:

| Trigger | SMS Content |
| --- | --- |
| **Quiz completion** (student scores ≥ 60) | `"${student.name} scored ${score}% on a quiz. Keep going! 💪"` |
| **Lesson assignment** | `"Your teacher assigned you: \"${lessonTitle}\". Open it from your home screen."` |
| **Support signal** (teacher flagged) | `"${learnerName} was flagged for review (${signalType}). Open the support signals page."` |

SMS is **only sent if the user has a phone number** stored in their profile. If no phone number is found, only the DB notification is created.

---

## 6. Testing Without Real Credentials

The system **works without Africa's Talking credentials**:

1. Set `sms.provider=mock` (default) or `sms.provider=africa_talking` with credentials.
2. With `mock` provider: all `sendSms()` calls record messages in memory and return mock IDs.
3. With `africa_talking` provider without credentials: `send()` returns a mock message ID and logs a warning — no crash.
4. Tests can verify sent messages via `MockSmsProvider.getSentMessages()`.

**No real SMS is sent** when using the mock provider or when credentials are absent.

---

## 7. Required Credentials (Blocker)

The only item that must be obtained externally:

| Credential | Source |
| --- | --- |
| API Key | Africa's Talking Dashboard |
| Sender ID | Africa's Talking Dashboard (optional, defaults to `DefaultSender`) |

**Without these:** SMS sending degrades gracefully — notifications are stored in DB only, no SMS delivered. All other features (auth, payments, AI, etc.) remain unaffected.

---

## 7. Callback URL (if needed)

For future two-way SMS integration, the callback URL would be:

```
http(s)://your-domain/api/sms/callback
```

Must return HTTP 200 on success. Not required for current implementation.

---

## 8. Error Handling

| Scenario | Result |
| --- | --- |
| Missing API key | Mock message ID returned, warning logged |
| Invalid phone format | `validateRecipient` returns error string; `send` proceeds anyway (SMS may fail at carrier) |
| Network failure | Error logged, exception propagated to caller |
| Rate limiting | Caller's responsibility; retry logic can be added via `SmsService` |

---

## 9. Dependencies

- `org.springframework.boot:spring-boot-starter-web` (for `@Value` injection)
- `com.fasterxml.jackson.module:jackson-module-kotlin` (for map serialization)
- No external SMS SDK required — direct HTTP API via `RestTemplate`
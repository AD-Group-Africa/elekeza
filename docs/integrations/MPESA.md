# M-Pesa Integration — Elekeza

## Overview

M-Pesa (Daraja API) integration for Kenyan mobile payments. STK Push for initiating payments,
callback URL for processing results, and revenue reporting.

The code is **complete** but requires a Daraja account and credentials for production use.
A test-mode fallback is available for development.

---

## 1. Sandbox Setup

1. Register for a [Safaricom Developer Portal](https://developer.safaricom.co.ke) account.
2. Create a new application and note the following:
   - **Consumer Key** (API key)
   - **Consumer Secret** (API secret)
3. Use the **Shortcode** assigned to your application (can be a Till Number or Paybill Number).
4. Set the **Callback URL** to point to your deployment:
   `https://your-domain.com/api/payments/callback`

## 2. Production Setup

1. Register for a production Daraja account.
2. Obtain production Consumer Key, Consumer Secret, and Shortcode.
3. Configure environment variables (see below).
4. Set `MPESA_ENVIRONMENT=production`.

---

## 3. Required Environment Variables

| Variable | Description | Example / Default |
| --- | --- | --- |
| `MPESA_CONSUMER_KEY` | Daraja Consumer Key (from developer portal) | |
| `MPESA_CONSUMER_SECRET` | Daraja Consumer Secret (from developer portal) | |
| `MPESA_PASSKEY` | M-Pesa Passkey (provided by Safaricom) | |
| `MPESA_SHORTCODE` | Business Shortcode ( Till Number or Paybill ) | |
| `MPESA_CALLBACK_URL` | Callback URL for STK Push results | `http://localhost:8080/api/payments/callback` |
| `MPESA_ENVIRONMENT` | `sandbox` or `production` | `sandbox` |

**Dev defaults** (from `application-dev.yaml`):
- `MPESA_ENVIRONMENT=sandbox`
- `MPESA_SHORTCODE=174379` (placeholder)

**Prod defaults** (from `application-prod.yaml`):
- `MPESA_ENVIRONMENT=production`
- `MPESA_SHORTCODE=174379` (placeholder)

---

## 4. Code Flow

### STK Push Request

```
POST /api/payments/stkpush
Body: { "phone": "+254712345678", "amount": 50, "reference": "school_fee_001" }
```

**What happens:**

1. `MpesaService.stkPush()` checks that `consumerKey` and `consumerSecret` are not blank.
2. If either is missing, returns HTTP 503 with message:
   `"M-Pesa payments are not configured for this deployment."`
3. Generates an OAuth access token from `https://sandbox.safaricom.co.ke/oauth/v1/generate`.
4. Computes the password: `Base64($shortcode$passkey$timestamp)`.
5. Sends the STK Push request to:
   - `https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest` (sandbox)
   - `https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest` (production)
6. Persists a `MpesaTransaction` with status `INITIATED`.
7. Returns `{ success, merchantRequestId, checkoutRequestId, message }`.

### Callback Processing

```
POST /api/payments/callback
Body: { "Body": { "stkCallback": { "CheckoutRequestID": "...", "ResultCode": 0, ... } } }
```

**What happens:**

1. `MpesaService.processCallback()` extracts `CheckoutRequestID`, `ResultCode`, `ResultDesc`, and `CallbackMetadata`.
2. Finds the existing `MpesaTransaction` by `CheckoutRequestID`.
3. Updates `status` to `COMPLETED` (ResultCode 0) or `FAILED` (non-zero).
4. Saves the `mpesaReceiptNumber` from metadata if present.
5. Logs the transaction.
6. Returns `{ ResultCode: 0, ResultDesc: "Success" }`.

### Revenue Reporting

```
GET /api/payments/revenue
```

Returns totals, counts, and monthly breakdowns filtered by `status = COMPLETED`.

---

## 5. Testing Without Real Credentials

The application gracefully degrades when M-Pesa credentials are not configured:

- `stkPush()` throws HTTP 503 with a clear message if `consumerKey`/`consumerSecret` are blank.
- The frontend should display this as a payment-unavailable notice.
- No real money is involved.

### Unit Test Support

For automated tests, you can set `MPESA_ENVIRONMENT=test` or provide mock credentials.
See `docs/integrations/MPESA.md` for the testing procedure.

Alternatively, Spring profile `test` can provide a stub implementation that returns pre-defined
responses without contacting the Daraja API.

---

## 6. Production Activation Procedure

1. Configure all environment variables listed in Section 3.
2. Deploy with `MPESA_ENVIRONMENT=production`.
3. Verify the `/api/payments/revenue` endpoint returns data after test callbacks.
4. Test the full flow:
   - Initiate STK Push → receive callback → check revenue endpoint.
5. Monitor logs for authentication or callback errors.

---

## 7. Required Credentials (Blocker)

The only item that must be obtained externally:

| Credential | Source |
| --- | --- |
| Consumer Key | Safaricom Developer Portal |
| Consumer Secret | Safaricom Developer Portal |
| Passkey | Safaricom (provided to registered developers) |
| Shortcode | Safaricom Developer Portal (assigned to your app) |

**Without these, STK Push will fail with 503 — the app boots and all other features work.**

---

## 8. Callback URL

Must be publicly accessible (or use a tunneling service like Ngrok in development):

```
http(s)://your-domain/api/payments/callback
```

The callback is POSTed by Safaricom after a STK Push attempt. It must return HTTP 200 with
a JSON body containing `ResultCode` and `ResultDesc` (the service returns `{ ResultCode: 0,
ResultDesc: "Success" }`).

---

## 9. Error Handling

| Scenario | Result |
| --- | --- |
| Missing credentials | HTTP 503 "M-Pesa payments are not configured" |
| Invalid phone number | HTTP 400 from Daraja |
| Insufficient funds | HTTP 402 from Daraja |
| Timeout | Retry logic is the caller's responsibility; transaction remains INITIATED |
| Callback not received | Transaction stays INITIATED; admin can manually reconcile via `/api/payments/revenue` |

---

## 10. Dependencies

- `org.springframework.boot:spring-boot-starter-web`
- `com.fasterxml.jackson.module:jackson-databind` (for JSON mapping)
- `org.springframework:spring-web` (RestTemplate)
- Database: `mpesa_transactions` table (created by Flyway migration V1 baseline)
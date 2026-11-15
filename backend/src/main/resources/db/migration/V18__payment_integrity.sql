-- ============================================================================
-- ELEKEZA — V18: payment integrity (idempotency keys + reconciliation state)
-- ----------------------------------------------------------------------------
-- Two gaps closed here (2026-10-16 payment-security remediation):
--
--  1. The provider idempotency keys had NO database uniqueness constraint, so
--     two concurrent duplicate callbacks could each pass the application-level
--     check-then-insert and create a duplicate financial credit. The unique
--     indexes below are the database-level half of the guarantee; the
--     conditional status transition in the application is the other half.
--
--  2. The reconciliation job needs per-transaction bookkeeping (attempt count,
--     next attempt time, last verification time) so an uncertain transaction can
--     be retried with backoff and then escalated instead of being silently lost
--     or guessed at.
--
-- NULL SEMANTICS: both indexed columns are nullable and multiple NULLs are
-- allowed (standard SQL unique-index behaviour). That is required: manual
-- payments carry no provider checkout id, and a durable intent exists before the
-- provider returns one.
--
-- ⚠ PRE-FLIGHT ON ANY DATABASE WITH EXISTING ROWS — run these first. If either
--   returns rows, DO NOT apply this migration: the unique index creation WILL
--   fail closed (by design), and financial records must never be deleted or
--   merged automatically. Reconcile the duplicates by hand, then retry.
--
--   SELECT checkout_request_id, COUNT(*) FROM mpesa_transactions
--    WHERE checkout_request_id IS NOT NULL
--    GROUP BY checkout_request_id HAVING COUNT(*) > 1;
--
--   SELECT checkout_request_id, COUNT(*) FROM payments
--    WHERE checkout_request_id IS NOT NULL
--    GROUP BY checkout_request_id HAVING COUNT(*) > 1;
--
-- ROLLBACK: DROP INDEX ux_mpesa_tx_checkout_request_id;
--           DROP INDEX ux_payment_checkout_request_id;
--           ALTER TABLE mpesa_transactions DROP COLUMN verification_attempts;
--           ALTER TABLE mpesa_transactions DROP COLUMN next_verification_at;
--           ALTER TABLE mpesa_transactions DROP COLUMN last_verified_at;
-- ============================================================================

CREATE UNIQUE INDEX ux_mpesa_tx_checkout_request_id
    ON mpesa_transactions (checkout_request_id);

CREATE UNIQUE INDEX ux_payment_checkout_request_id
    ON payments (checkout_request_id);

ALTER TABLE mpesa_transactions ADD COLUMN verification_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE mpesa_transactions ADD COLUMN next_verification_at TIMESTAMPTZ;
ALTER TABLE mpesa_transactions ADD COLUMN last_verified_at TIMESTAMPTZ;

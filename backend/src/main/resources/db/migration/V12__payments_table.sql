-- V8: Payments table (BE-012)

CREATE TABLE IF NOT EXISTS payments (
                                        id                   BIGSERIAL PRIMARY KEY,
                                        user_id              BIGINT       NOT NULL REFERENCES users(id),
    school_id            VARCHAR(100),
    phone                VARCHAR(20)  NOT NULL,
    amount               INT          NOT NULL,
    checkout_request_id  VARCHAR(100) NOT NULL UNIQUE,
    merchant_request_id  VARCHAR(100),
    status               VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    mpesa_receipt        VARCHAR(50),
    created_at           TIMESTAMP    DEFAULT NOW(),
    updated_at           TIMESTAMP    DEFAULT NOW(),
    CONSTRAINT chk_payment_status CHECK (status IN ('PENDING','COMPLETE','FAILED'))
    );

CREATE INDEX IF NOT EXISTS idx_payments_user      ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_checkout  ON payments(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_payments_status    ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created   ON payments(created_at DESC);
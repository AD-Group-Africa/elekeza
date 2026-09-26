-- ============================================================================
-- ELEKEZA — V15 devices, regional configuration, billing architecture
-- ----------------------------------------------------------------------------
-- 1. devices + device_assignments — software-side device identity for the
--    Access phase: registration, institution association, learner assignment,
--    activation/revocation. Actual hardware/MDM remains external.
-- 2. country_configs — East Africa readiness: per-country currency, timezone,
--    language, payment/communication provider selection. Kenya remains the
--    seeded default; nothing is hard-coded in domain code.
-- 3. billing_plans / billing_subscriptions / billing_invoices — internal
--    billing domain independent of any payment processor; entitlement checks
--    read subscription state. institutions.plan (V1) remains the display plan.
-- ============================================================================

-- ─── 1. DEVICES ─────────────────────────────────────────────────────────────
CREATE TABLE devices (
    id             BIGSERIAL PRIMARY KEY,
    institution_id BIGINT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    device_code    VARCHAR(64) NOT NULL UNIQUE,      -- human-readable identity (e.g. EK-DV-000123)
    label          VARCHAR(255),
    status         VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING|ACTIVE|REVOKED|LOST
    last_seen_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_devices_status CHECK (status IN ('PENDING','ACTIVE','REVOKED','LOST'))
);
CREATE INDEX idx_devices_institution ON devices(institution_id);

CREATE TABLE device_assignments (
    id          BIGSERIAL PRIMARY KEY,
    device_id   BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    learner_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    returned_at TIMESTAMPTZ,
    CONSTRAINT uq_device_assignment_open UNIQUE (device_id, returned_at)
);
CREATE INDEX idx_device_assignments_learner ON device_assignments(learner_id);

-- ─── 2. REGIONAL CONFIGURATION ──────────────────────────────────────────────
CREATE TABLE country_configs (
    id                  BIGSERIAL PRIMARY KEY,
    country_code        VARCHAR(2) NOT NULL UNIQUE,   -- ISO 3166-1 alpha-2
    country_name        VARCHAR(255) NOT NULL,
    currency_code       VARCHAR(3) NOT NULL,          -- ISO 4217
    timezone            VARCHAR(64) NOT NULL,
    default_language    VARCHAR(16) NOT NULL DEFAULT 'en',
    payment_provider    VARCHAR(64) NOT NULL DEFAULT 'MPESA_MOCK',
    communication_provider VARCHAR(64) NOT NULL DEFAULT 'SMS_MOCK',
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kenya is the current implementation default; other countries are added when
-- there is real regulatory/curriculum information — never fabricated.
INSERT INTO country_configs (country_code, country_name, currency_code, timezone, default_language, payment_provider, communication_provider)
VALUES ('KE', 'Kenya', 'KES', 'Africa/Nairobi', 'en', 'MPESA_MOCK', 'SMS_MOCK');

-- ─── 3. BILLING ARCHITECTURE ────────────────────────────────────────────────
CREATE TABLE billing_plans (
    id           BIGSERIAL PRIMARY KEY,
    code         VARCHAR(64) NOT NULL UNIQUE,     -- STARTER|GROWTH|SCHOOL|…
    name         VARCHAR(255) NOT NULL,
    max_students INT NOT NULL,
    max_teachers INT NOT NULL,
    price_monthly NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'KES',
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE billing_subscriptions (
    id             BIGSERIAL PRIMARY KEY,
    institution_id BIGINT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    plan_id        BIGINT NOT NULL REFERENCES billing_plans(id) ON DELETE RESTRICT,
    status         VARCHAR(20) NOT NULL DEFAULT 'TRIALING', -- TRIALING|ACTIVE|PAST_DUE|CANCELLED
    started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ,
    cancelled_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_sub_status CHECK (status IN ('TRIALING','ACTIVE','PAST_DUE','CANCELLED')),
    CONSTRAINT uq_sub_institution_active UNIQUE (institution_id, status)
);
CREATE INDEX idx_subscriptions_institution ON billing_subscriptions(institution_id);

CREATE TABLE billing_invoices (
    id               BIGSERIAL PRIMARY KEY,
    institution_id   BIGINT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    subscription_id  BIGINT REFERENCES billing_subscriptions(id) ON DELETE SET NULL,
    amount           NUMERIC(12,2) NOT NULL,
    currency_code    VARCHAR(3) NOT NULL DEFAULT 'KES',
    status           VARCHAR(20) NOT NULL DEFAULT 'OPEN',  -- OPEN|PAID|VOID|UNCOLLECTIBLE
    period_start     TIMESTAMPTZ,
    period_end       TIMESTAMPTZ,
    issued_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_invoice_status CHECK (status IN ('OPEN','PAID','VOID','UNCOLLECTIBLE'))
);
CREATE INDEX idx_billing_invoices_institution ON billing_invoices(institution_id, status);

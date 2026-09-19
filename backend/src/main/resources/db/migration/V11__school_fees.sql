-- V11: School fees / payments domain.
-- The school-fee layer sits ABOVE the existing M-Pesa transaction records
-- (mpesa_transactions stays the provider integration ledger). Domain chain:
-- AcademicPeriod → FeeItem → FeeStructure → LearnerCharge (invoice) →
-- Payment → PaymentAllocation. Financial state (balances) is always derived
-- server-side from charges minus allocations; the client never submits
-- balances or statuses.

CREATE TABLE academic_periods (
    id             BIGSERIAL PRIMARY KEY,
    institution_id BIGINT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    name           VARCHAR(120) NOT NULL,           -- e.g. "2026 Term 1"
    start_date     DATE,
    end_date       DATE,
    is_current     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_period_institution_name UNIQUE (institution_id, name)
);
CREATE INDEX idx_period_institution ON academic_periods(institution_id);

CREATE TABLE fee_items (
    id             BIGSERIAL PRIMARY KEY,
    institution_id BIGINT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    name           VARCHAR(120) NOT NULL,           -- Tuition, Transport, Meals, Activity, Boarding…
    description    VARCHAR(500),
    amount         DOUBLE PRECISION NOT NULL CHECK (amount >= 0),
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_fee_item_institution ON fee_items(institution_id);

CREATE TABLE fee_structures (
    id             BIGSERIAL PRIMARY KEY,
    institution_id BIGINT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    period_id      BIGINT NOT NULL REFERENCES academic_periods(id) ON DELETE CASCADE,
    fee_item_id    BIGINT NOT NULL REFERENCES fee_items(id) ON DELETE CASCADE,
    -- Optional class scoping: NULL applies the item school-wide for the period.
    class_id       BIGINT REFERENCES classes(id) ON DELETE CASCADE,
    amount         DOUBLE PRECISION NOT NULL CHECK (amount >= 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fee_structure UNIQUE (institution_id, period_id, fee_item_id, class_id)
);
CREATE INDEX idx_fee_structure_period ON fee_structures(period_id);

CREATE TABLE learner_charges (
    id             BIGSERIAL PRIMARY KEY,
    institution_id BIGINT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    period_id      BIGINT NOT NULL REFERENCES academic_periods(id),
    fee_item_id    BIGINT NOT NULL REFERENCES fee_items(id),
    learner_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount         DOUBLE PRECISION NOT NULL CHECK (amount >= 0),
    description    VARCHAR(500),
    charge_number  VARCHAR(40) NOT NULL UNIQUE,     -- human reference, e.g. INV-2026-000123
    due_date       DATE,
    status         VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING | PARTIALLY_PAID | PAID | VOID
    void_reason    VARCHAR(500),
    created_by     BIGINT REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_charge_institution ON learner_charges(institution_id);
CREATE INDEX idx_charge_learner ON learner_charges(learner_id);
CREATE INDEX idx_charge_period ON learner_charges(period_id);

CREATE TABLE payments (
    id                BIGSERIAL PRIMARY KEY,
    institution_id    BIGINT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    learner_id        BIGINT NOT NULL REFERENCES users(id),
    amount            DOUBLE PRECISION NOT NULL CHECK (amount > 0),
    method            VARCHAR(20) NOT NULL,          -- MPESA | CASH | BANK
    status            VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',  -- PENDING | COMPLETED | FAILED
    provider_ref      VARCHAR(100),                  -- M-Pesa receipt / bank slip ref
    checkout_request_id VARCHAR(100),                -- links to mpesa_transactions when MPESA
    note              VARCHAR(500),
    recorded_by       BIGINT REFERENCES users(id),   -- who entered it (manual) / null for provider
    payment_number    VARCHAR(40) NOT NULL UNIQUE,   -- human reference, e.g. RCP-2026-000456
    paid_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payment_institution ON payments(institution_id);
CREATE INDEX idx_payment_learner ON payments(learner_id);
CREATE INDEX idx_payment_checkout ON payments(checkout_request_id);

CREATE TABLE payment_allocations (
    id          BIGSERIAL PRIMARY KEY,
    payment_id  BIGINT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    charge_id   BIGINT NOT NULL REFERENCES learner_charges(id),
    amount      DOUBLE PRECISION NOT NULL CHECK (amount > 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_allocation_payment ON payment_allocations(payment_id);
CREATE INDEX idx_allocation_charge ON payment_allocations(charge_id);

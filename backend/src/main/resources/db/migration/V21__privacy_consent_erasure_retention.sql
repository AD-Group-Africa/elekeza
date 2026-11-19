-- ============================================================================
-- V21 — guardian consent, account erasure and retention evidence
-- ----------------------------------------------------------------------------
-- Why this exists
--   The pre-pilot audit (docs/audit/ELEKEZA_PRE_PILOT_AUDIT.md) recorded three
--   P0 privacy gaps: no consent capture, no erasure path and no retention rule.
--   Elekeza holds information about children, so those are not optional.
--
-- What this migration does NOT do
--   * No personal data is moved, rewritten or backfilled. Existing rows are
--     untouched; every new column is nullable or defaulted.
--   * It does not create a retention trigger on users. Deleting people
--     automatically is a policy decision for the school, not a side effect of
--     deploying code.
--
-- Design notes
--   * consent_records is append-only history: withdrawing sets withdrawn_at
--     instead of deleting the row, so proof of what was agreed (and when) is
--     preserved. Uniqueness of an *active* consent is enforced in
--     ConsentService, not by a partial index, so the schema stays portable to
--     the H2 test database.
--   * subject_user_id separates "I consent for myself" (NULL) from "I consent
--     for this learner" (their user id). A guardian may only create the
--     second kind for a learner with a currently active guardian link.
--   * data_erasure_log deliberately has no foreign key to users: the log must
--     survive independently of the account it describes, and it stores counts
--     and a reason — never names, emails or phone numbers.
--   * retention_runs records what each sweep deleted (or would delete, in a
--     dry run) so retention can be evidenced rather than asserted.
-- ============================================================================

CREATE TABLE consent_records (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT       NOT NULL,           -- who gave the consent
    consent_type     VARCHAR(40)  NOT NULL,           -- ConsentType enum name
    subject_user_id  BIGINT       NULL,               -- NULL = for themselves
    institution_id   BIGINT       NULL,               -- school context, when known
    policy_version   VARCHAR(20)  NOT NULL,           -- the wording that was agreed
    granted          BOOLEAN      NOT NULL DEFAULT TRUE,
    granted_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    withdrawn_at     TIMESTAMPTZ  NULL,               -- set on withdrawal
    source           VARCHAR(40)  NOT NULL DEFAULT 'API',  -- API | SCHOOL_IMPORT
    note             VARCHAR(255) NULL
);

CREATE INDEX idx_consent_user    ON consent_records(user_id);
CREATE INDEX idx_consent_subject ON consent_records(subject_user_id);
-- Supports "is there an active consent of type X for this user?" lookups.
CREATE INDEX idx_consent_active  ON consent_records(user_id, consent_type, withdrawn_at);

COMMENT ON TABLE consent_records IS
    'Append-only guardian/self consent history. Withdrawal sets withdrawn_at; rows are never deleted on withdrawal.';

CREATE TABLE data_erasure_log (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT       NOT NULL,              -- the erased account's id (no PII)
    actor_id      BIGINT       NULL,                  -- who triggered it (self or admin)
    reason        VARCHAR(255) NOT NULL,
    requested_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    completed_at  TIMESTAMPTZ  NULL,
    links_revoked INTEGER      NOT NULL DEFAULT 0,
    consents_withdrawn INTEGER NOT NULL DEFAULT 0,
    already_erased BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_erasure_user ON data_erasure_log(user_id);

COMMENT ON TABLE data_erasure_log IS
    'Evidence that an erasure ran. Holds identifiers and counts only — no names, emails or phone numbers.';

CREATE TABLE retention_runs (
    id                    BIGSERIAL PRIMARY KEY,
    started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at           TIMESTAMPTZ NULL,
    dry_run               BOOLEAN     NOT NULL DEFAULT TRUE,
    password_reset_tokens INTEGER     NOT NULL DEFAULT 0,
    refresh_tokens        INTEGER     NOT NULL DEFAULT 0,
    notifications         INTEGER     NOT NULL DEFAULT 0,
    engagement_events     INTEGER     NOT NULL DEFAULT 0,
    consent_records       INTEGER     NOT NULL DEFAULT 0,
    total_deleted         INTEGER     NOT NULL DEFAULT 0
);

COMMENT ON TABLE retention_runs IS
    'One row per retention sweep (scheduled or manual). Dry runs record what would have been deleted.';

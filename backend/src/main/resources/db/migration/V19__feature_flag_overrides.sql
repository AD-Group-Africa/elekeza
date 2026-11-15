-- ============================================================================
-- ELEKEZA — V19: feature flag override persistence
-- ----------------------------------------------------------------------------
-- Sprint 3: runtime feature-flag overrides were held in an in-memory
-- ConcurrentHashMap and silently disappeared whenever the backend restarted
-- (a "kill switch" that killed itself). Settings an override is a deliberate
-- operations decision, so it must survive process replacement, not the
-- deployment that carried it into application.yaml.
--
-- The yaml `features` config remains the source of truth for enabled-by-
-- default flags; this table persists only the ADMIN runtime override layer
-- (exactly the DTO the /api/admin/flags contract exposes).
-- ============================================================================

CREATE TABLE feature_flag_overrides (
    flag_name  VARCHAR(100) NOT NULL,
    enabled    BOOLEAN      NOT NULL,
    updated_by BIGINT       NULL,
    updated_at TIMESTAMP    NOT NULL,

    CONSTRAINT pk_feature_flag_overrides PRIMARY KEY (flag_name)
);

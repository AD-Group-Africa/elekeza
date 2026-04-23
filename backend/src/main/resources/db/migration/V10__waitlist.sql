CREATE TABLE IF NOT EXISTS waitlist_entries (
                                                id         BIGSERIAL PRIMARY KEY,
                                                email      VARCHAR(255) NOT NULL UNIQUE,
    name       VARCHAR(100) NOT NULL,
    role       VARCHAR(50)  NOT NULL,
    school     VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS idx_waitlist_email      ON waitlist_entries(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_role       ON waitlist_entries(role);
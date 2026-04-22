-- V6: Content/Upload table (BE-008)

CREATE TABLE IF NOT EXISTS content (
                                       id                BIGSERIAL PRIMARY KEY,
                                       user_id           BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title             VARCHAR(255),
    original_filename VARCHAR(255),
    file_path         TEXT,
    sne_type          VARCHAR(50),
    status            VARCHAR(20)  NOT NULL DEFAULT 'UPLOADING',
    simplified_text   TEXT,
    word_count        INT,
    created_at        TIMESTAMP    DEFAULT NOW(),
    updated_at        TIMESTAMP    DEFAULT NOW(),
    CONSTRAINT chk_content_status CHECK (status IN ('UPLOADING','PROCESSING','READY','FAILED'))
    );

CREATE INDEX IF NOT EXISTS idx_content_user_id ON content(user_id);
CREATE INDEX IF NOT EXISTS idx_content_status  ON content(status);
CREATE INDEX IF NOT EXISTS idx_content_created ON content(created_at DESC);
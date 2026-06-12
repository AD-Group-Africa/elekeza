CREATE TABLE IF NOT EXISTS content_assignments (
                                                   id BIGSERIAL PRIMARY KEY,
                                                   content_id BIGINT NOT NULL REFERENCES content(id),
    student_id BIGINT NOT NULL REFERENCES users(id),
    assigned_by BIGINT NOT NULL REFERENCES users(id),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(content_id, student_id)
    );
CREATE INDEX IF NOT EXISTS idx_assignments_student ON content_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_content ON content_assignments(content_id);
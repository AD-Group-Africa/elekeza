-- V10: Attendance module.
-- A school (institution) organizes learners into classes (SchoolClass); a
-- learner is enrolled in exactly one class at a time. Staff take attendance
-- per class and date (an AttendanceSession is created lazily on first save);
-- each learner in that session gets one AttendanceRecord with a status.
-- Uniqueness of (session, learner) makes duplicate marking an UPDATE, not a
-- second row, so repeated saves can never corrupt the register.

CREATE TABLE classes (
    id             BIGSERIAL PRIMARY KEY,
    institution_id BIGINT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    name           VARCHAR(120) NOT NULL,
    grade_level    VARCHAR(50),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- A school never has two classes with the same name ("Grade 4 Blue").
    CONSTRAINT uq_class_institution_name UNIQUE (institution_id, name)
);
CREATE INDEX idx_class_institution ON classes(institution_id);

CREATE TABLE class_enrollments (
    id          BIGSERIAL PRIMARY KEY,
    class_id    BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    learner_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    -- One active enrollment per learner at a time.
    CONSTRAINT uq_enrollment_learner_active UNIQUE (class_id, learner_id, active)
);
CREATE INDEX idx_enrollment_class ON class_enrollments(class_id);
CREATE INDEX idx_enrollment_learner ON class_enrollments(learner_id);

CREATE TABLE attendance_sessions (
    id          BIGSERIAL PRIMARY KEY,
    class_id    BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    recorded_by BIGINT NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- One register per class per day.
    CONSTRAINT uq_session_class_date UNIQUE (class_id, session_date)
);
CREATE INDEX idx_session_class ON attendance_sessions(class_id);
CREATE INDEX idx_session_date ON attendance_sessions(session_date);

CREATE TABLE attendance_records (
    id          BIGSERIAL PRIMARY KEY,
    session_id  BIGINT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    learner_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      VARCHAR(20) NOT NULL,               -- PRESENT | ABSENT | LATE | EXCUSED
    note        VARCHAR(500),
    recorded_by BIGINT NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- The register cell: exactly one status per learner per session.
    CONSTRAINT uq_record_session_learner UNIQUE (session_id, learner_id),
    CONSTRAINT ck_record_status CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED'))
);
CREATE INDEX idx_record_session ON attendance_records(session_id);
CREATE INDEX idx_record_learner ON attendance_records(learner_id);

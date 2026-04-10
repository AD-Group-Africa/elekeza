-- V7: Add cognitive_profile column to learners
ALTER TABLE learners
    ADD COLUMN IF NOT EXISTS cognitive_profile VARCHAR(50) NOT NULL DEFAULT 'DEFAULT';wh

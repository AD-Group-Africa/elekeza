-- V7: Add learner_cognitive_profiles collection table
-- (replaces single cognitive_profile column approach)
CREATE TABLE IF NOT EXISTS learner_cognitive_profiles (
                                                          learner_id UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    profile    VARCHAR(50) NOT NULL
    );

CREATE INDEX IF NOT EXISTS idx_learner_cognitive_profiles_learner_id
    ON learner_cognitive_profiles(learner_id);

-- If an old cognitive_profile column exists from a previous migration attempt, drop it safely
ALTER TABLE learners DROP COLUMN IF EXISTS cognitive_profile;
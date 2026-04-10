-- V5: Reconcile quiz_questions options column
-- options is already JSONB in V3, this is a safe no-op guard
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quiz_questions'
          AND column_name = 'options'
          AND data_type = 'jsonb'
    ) THEN
ALTER TABLE quiz_questions
ALTER COLUMN options TYPE jsonb USING options::jsonb;
END IF;
END $$;

-- Add summary_message to quizzes if missing
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS summary_message TEXT;
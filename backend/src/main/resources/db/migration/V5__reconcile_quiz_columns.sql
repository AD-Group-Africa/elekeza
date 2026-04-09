-- Reconcile legacy quiz column names across environments.
-- Canonical columns:
--   quiz_questions.sequence_number
--   quiz_responses.quiz_question_id

DO $$
BEGIN
    -- quiz_questions: question_order -> sequence_number
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'quiz_questions'
          AND column_name = 'question_order'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'quiz_questions'
          AND column_name = 'sequence_number'
    ) THEN
        ALTER TABLE quiz_questions RENAME COLUMN question_order TO sequence_number;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'quiz_questions'
          AND column_name = 'question_order'
    )
    AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'quiz_questions'
          AND column_name = 'sequence_number'
    ) THEN
        UPDATE quiz_questions
        SET sequence_number = COALESCE(sequence_number, question_order)
        WHERE sequence_number IS NULL;

        ALTER TABLE quiz_questions
            ALTER COLUMN sequence_number SET NOT NULL;

        ALTER TABLE quiz_questions
            DROP COLUMN question_order;
    END IF;

    -- quiz_responses: question_id -> quiz_question_id
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'quiz_responses'
          AND column_name = 'question_id'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'quiz_responses'
          AND column_name = 'quiz_question_id'
    ) THEN
        ALTER TABLE quiz_responses RENAME COLUMN question_id TO quiz_question_id;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'quiz_responses'
          AND column_name = 'question_id'
    )
    AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'quiz_responses'
          AND column_name = 'quiz_question_id'
    ) THEN
        UPDATE quiz_responses
        SET quiz_question_id = COALESCE(quiz_question_id, question_id)
        WHERE quiz_question_id IS NULL;

        ALTER TABLE quiz_responses
            ALTER COLUMN quiz_question_id SET NOT NULL;

        ALTER TABLE quiz_responses
            DROP COLUMN question_id;
    END IF;
END $$;


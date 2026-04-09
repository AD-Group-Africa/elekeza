-- Prevent multiple active quizzes for the same learner+lesson pair.

-- If duplicates exist, keep the most recent open quiz and close older ones.
WITH ranked_open AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY lesson_id, learner_id
            ORDER BY created_at DESC, id DESC
        ) AS rn
    FROM quizzes
    WHERE completed_at IS NULL
)
UPDATE quizzes q
SET completed_at = COALESCE(q.updated_at, q.created_at, now())
FROM ranked_open ro
WHERE q.id = ro.id
  AND ro.rn > 1;

-- Enforce at most one open quiz per learner+lesson.
CREATE UNIQUE INDEX IF NOT EXISTS ux_quizzes_open_lesson_learner
    ON quizzes(lesson_id, learner_id)
    WHERE completed_at IS NULL;


-- V6: Prevent duplicate incomplete quizzes for same learner+lesson
-- Uses partial unique index on quizzes where completed_at IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_open_per_lesson_learner
    ON quizzes (lesson_id, learner_id)
    WHERE completed_at IS NULL;
-- V9: Manual marking support for exam short-answer questions.
-- Objective questions (MCQ / TRUE_FALSE) are auto-marked server-side; short
-- answers are marked by authorized staff. marks_awarded is stored per answer
-- row (also usable for partial credit later); feedback is shown to the student
-- with their result. Attempt totals are recalculated after each marking.

ALTER TABLE exam_answers ADD COLUMN marks_awarded DOUBLE PRECISION;
ALTER TABLE exam_answers ADD COLUMN feedback TEXT;

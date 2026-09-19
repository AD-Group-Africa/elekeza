INSERT INTO quizzes (id, content_id, user_id) VALUES (1, 1, 2);
INSERT INTO quiz_questions (quiz_id, question, option_a, option_b, option_c, option_d, correct_option, explanation) VALUES
(1, 'What is the first step in the water cycle?', 'Evaporation', 'Condensation', 'Precipitation', 'Collection', 'A', 'The sun heats water and turns it into vapor.');
INSERT INTO quiz_questions (quiz_id, question, option_a, option_b, option_c, option_d, correct_option, explanation) VALUES
(1, 'What happens during condensation?', 'Water freezes', 'Vapor turns into water drops', 'Rain falls', 'Rivers flow', 'B', 'Vapor cools and forms clouds.');
INSERT INTO quiz_attempts (id, quiz_id, user_id, score, total_questions, completed, completed_at) VALUES
(1, 1, 1, 0.8, 2, true, NOW());

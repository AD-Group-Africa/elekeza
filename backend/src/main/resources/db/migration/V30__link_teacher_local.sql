-- V30: Link teacher to institution 1 for local dev
UPDATE users SET institution_id = 1 WHERE email = 'teacher@elekeza.app' AND institution_id IS NULL;

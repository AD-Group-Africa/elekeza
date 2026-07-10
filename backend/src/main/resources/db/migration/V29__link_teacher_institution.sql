-- V29: Link existing teacher to institution 1
UPDATE users SET institution_id = 1 WHERE email = 'teacher@elekeza.app' AND institution_id IS NULL;

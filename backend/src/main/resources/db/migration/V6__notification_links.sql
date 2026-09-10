-- Notifications may carry an in-app navigation target (e.g. "/lesson/42")
-- so clicking a notification in the UI can route the recipient to the
-- relevant lesson/assignment instead of dead-ending at "marked read".
ALTER TABLE notifications ADD COLUMN link VARCHAR(255);

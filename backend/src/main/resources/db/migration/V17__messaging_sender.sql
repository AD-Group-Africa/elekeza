-- EL-NEW-02 Phase 1: two-way guardian↔teacher messaging.
-- Adds optional sender attribution to notifications so a message saved for a
-- recipient records who sent it. Additive only: existing notification rows
-- keep sender_id NULL and every pre-existing read path is unaffected.
ALTER TABLE notifications ADD COLUMN sender_id BIGINT REFERENCES users(id);

CREATE INDEX idx_notif_sender_recipient ON notifications(sender_id, user_id);

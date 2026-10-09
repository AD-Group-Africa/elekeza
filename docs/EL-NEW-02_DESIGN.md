# EL-NEW-02 — Two-Way Messaging: Design & Implementation Plan

**Status:** DEFERRED to pilot #2
**Discovered:** 2026-10-02 · **Verified in code:** 2026-10-08
**Severity:** MEDIUM

## Summary

The communication pages render as if two-way messaging exists, but the plumbing
does not. MessageController saves every message against the sender's user ID and
ignores the recipient field entirely. No teacher-side read endpoint exists.
The frontend sends literal strings ("teacher", "1,2,3") that cannot resolve to users.

This is a design change, not a bounded patch.

## Verified Findings

| File | Behavior | Reality |
|---|---|---|
| NotificationService.kt | Notification entity | userId = recipient. No senderId field. |
| NotificationService.kt | NotificationRepository | Only findByUserIdOrderByCreatedAtDesc. No type filter. |
| NotificationService.kt | NotificationDto | No sender info. |
| MessageController.kt | sendNotification() | Saves userId = sender.id. req.recipient ignored. |
| MessageController.kt | guardianSendMessage() | Same. |
| MessageController.kt | guardianGetMessages() | Returns sender's own outbox. |
| guardian/communication/page.tsx | api.post | Sends { recipient: 'teacher' }. Literal string. |
| teacher/communication/page.tsx | api.post | Sends CSV of learner IDs to /notifications/send. |
| Teacher read | — | No endpoint exists. |

## Product Model (needs Harry sign-off)

| Flow | Sender | Recipient resolution | Read endpoint |
|---|---|---|---|
| Guardian → Teacher | GUARDIAN | Teachers at child's institution | new GET /api/teacher/messages |
| Teacher → Learner | TEACHER | Selected learners | existing notifications UI |
| Teacher → Guardian | TEACHER | Guardians of selected learners | existing GET /guardian/messages |

Priority: Guardian ↔ Teacher.

## Backend Changes

1. Migration V17__messaging_sender.sql
   ALTER TABLE notifications ADD COLUMN sender_id BIGINT REFERENCES users(id);
   CREATE INDEX idx_notif_sender_recipient ON notifications(sender_id, user_id);

2. Notification entity — add val senderId: Long? = null

3. NotificationDto — add senderId, senderName

4. NotificationRepository — add findByUserIdAndTypeInOrderByCreatedAtDesc

5. MessageController rewrite — resolve recipient CSV, save userId=recipient.id, senderId=sender.id

6. New GET /api/teacher/messages

## Frontend Changes

1. Guardian page — recipient picker from new GET /api/guardian/teachers
2. Teacher page — thread view
3. New GET /api/guardian/teachers

## Effort

~3 hours.

## Decision

DEFERRED to pilot #2 unless Harry requires two-way messaging in pilot #1.
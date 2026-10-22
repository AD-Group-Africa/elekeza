# Backend changes the frontend needs

What the backend team needs to change or add so the web app works fully. Items are grouped by
urgency. Each one says what is wrong today, what to build, and what the frontend does in the
meantime. Sizes: S = a day or less, M = a few days.

## 0. Already done on branch `frontend/complete-system` (please review and merge)

These are in commit `backend: class management endpoints for the admin UI`, with tests in
`backend/src/test/.../attendance/ClassManagementApiTest.kt`.

| Change | Why |
| --- | --- |
| `POST /api/attendance/classes` (409 on duplicate name) | School admins create classes from `/classes`. Before this, classes could only be made in seed data. |
| `GET` / `POST /api/attendance/classes/{id}/learners` | List and enrol learners (same school only). |
| `DELETE /api/attendance/classes/{id}/learners/{learnerId}` | Remove a learner from a class. |
| `GET /api/content/list` returns `objectiveId` | Shows which curriculum objective a lesson is linked to. |
| Guardian digest attendance rate excludes `EXCUSED` days | The guardian page showed two different percentages for the same child (80% vs 88.9%). Both now use the attendance module's formula. |

## 1. Must fix (wrong or inconsistent today)

| # | Problem | What to build | Frontend today | Size |
| --- | --- | --- | --- | --- |
| 1.1 | Guardians only see national/regional calendar dates, not their child's school dates. The calendar is scoped by the viewer's institution, and guardian accounts have none. | Resolve the guardian's institution(s) through their linked children in the calendar query. | Shows national/regional dates only. | S |
| 1.2 | `GET /api/teacher/students` returns ids as strings; every other endpoint uses numbers. | Return numeric ids. | `teacherApi.students` converts them. Remove that once fixed. | S |
| 1.3 | `POST /api/content/upload/file` ignores the lesson title. | Accept a `title` form field; fall back to the file name. | File lessons are named after the file. | S |
| 1.4 | Feature-flag overrides are kept in memory and lost on restart. | Persist overrides in a table. | The platform console warns about this. | S |
| 1.5 | Attendance percentages cover different periods: guardian digest = last 60 days, learner history = all time, admin summary = last 30 days. | Return the period (`from`, `to`) with each rate, or accept a `days` parameter everywhere. | Shows the rates without their period. | S |

## 2. Missing endpoints for existing screens

| # | Screen | What to build | Size |
| --- | --- | --- | --- |
| 2.1 | Devices (`/admin/devices`) | `DELETE /api/devices/{id}/assign` to un-assign (return the device), and `PATCH /api/devices/{id}` to edit the label. | S |
| 2.2 | Classes (`/classes`) | `PATCH /api/attendance/classes/{id}` to rename / change grade, and an archive flag (archived classes hidden from registers). | S |
| 2.3 | Classes for teachers | Let a school admin assign a class teacher (`teacherId` on the class), and filter `GET /classes` to the teacher's own classes. | S |

## 3. Needed for the next features (see IMPROVEMENTS.md)

| # | Feature | What the backend needs | Size |
| --- | --- | --- | --- |
| 3.1 | Termly report cards | `GET /api/reports/learners/{id}?termId=` returning competency levels per learning area, attendance for the term, exam results and a teacher comment field (plus `PUT` for the comment). PDF can be done on the frontend or backend. | M |
| 3.2 | Guardian self-linking | `POST /api/learners/{id}/link-code` (admin issues a short code, expires) and `POST /api/guardian/link` (guardian redeems it). | M |
| 3.3 | Fee reminders | Scheduled job that creates notifications (with `link: "/guardian/fees"`) before the due date and when overdue; SMS through the existing provider. | M |
| 3.4 | Bulk attendance | Already possible with the session endpoint; optional `markAllPresent` flag to save a payload of 40 records. | S |
| 3.5 | CSV export | `GET .../export.csv` for learners, fee balances and attendance (or the frontend builds CSV from the JSON it already has). | S |
| 3.6 | Parent–teacher meetings | Meeting slots on the calendar: teacher publishes slots, guardian books one, both get a notification. | M |
| 3.7 | County / government dashboard (`/government`, now "Coming soon") | Role + endpoint with anonymised, aggregated attendance and competency trends by school/sub-county. | M |
| 3.8 | Kiswahili | Notification and email templates in Kiswahili, using the user's language preference. | M |

## 4. Contract hygiene

- **Publish an OpenAPI spec** (springdoc) so the frontend can generate types and catch mismatches like
  1.2 at build time.
- **One error shape** for all 4xx responses (`{ code, message, fields? }`). Most endpoints do this;
  keep new ones consistent so form errors show next to the right field.
- **Dates**: send calendar days as `YYYY-MM-DD` and timestamps as ISO-8601 with an offset. The
  frontend treats a bare date as a local calendar day.
- **Notifications**: keep `link` a relative app path (e.g. `/guardian/fees`). The frontend ignores
  anything else for safety.

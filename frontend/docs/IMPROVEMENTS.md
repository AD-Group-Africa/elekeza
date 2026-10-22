# Improvements and next steps

Ideas gathered while building out the frontend against the product README. Each item says what it
is, why it helps, and roughly how big it is (S = a day or less, M = a few days, L = a week or more).
Items marked **backend** need an API change first.

## 1. Fix soon (known limitations)

| # | Item | Why | Size |
| --- | --- | --- | --- |
| 1.1 | **backend** Give guardians an institution (or resolve it through their children) | Guardians currently only see national/regional calendar dates, not their child's school dates, because the calendar is scoped by the viewer's institution. | S |
| 1.2 | **backend** `/api/teacher/students` returns ids as strings | The frontend now converts them, but every other endpoint uses numbers. Return numbers so clients don't need a workaround. | S |
| 1.3 | **backend** `POST /api/content/upload/file` ignores the lesson title | File lessons are named after the file. Accept a `title` field. | S |
| 1.4 | **backend** Feature-flag overrides are lost on restart | The platform console says so, but persisting them (DB table) makes the switch trustworthy. | S |
| 1.5 | **backend** Devices cannot be un-assigned or edited (label) | Add `DELETE /devices/{id}/assign` and `PATCH /devices/{id}` for label changes. | S |
| 1.6 | Classes cannot be renamed or archived | Add rename/archive (backend endpoint + a menu on the class card). | S |
| 1.7 | Attendance percentages cover different periods (guardian digest: last 60 days; learner history: all time; admin summary: last 30 days) | They now share one formula (excused days excluded), but showing the period next to each percentage stops them looking contradictory. | S |

## 2. High-value features

| # | Item | Why | Size |
| --- | --- | --- | --- |
| 2.1 | **Kiswahili translation** (message catalogue per feature, language switch in settings) | Most guardians and many learners are more comfortable in Kiswahili; the README targets Kenyan schools. Start with learner and guardian screens. | L |
| 2.2 | **Report cards per term** (competency levels per learning area + attendance + teacher comment, PDF) | CBC schools must issue termly reports; the data now exists (curriculum progress, attendance, exams). | M |
| 2.3 | **Bulk attendance actions** ("mark all present", then change exceptions) | Cuts register time for a class of 40 from minutes to seconds. | S |
| 2.4 | **Fee reminders** to guardians (in-app + SMS) before the due date and when overdue | Directly improves fee collection, the main pain point for school admins. | M |
| 2.5 | **Guardian self-linking with a code** printed on the learner's record | Removes admin work: the school gives the parent a code, the parent links themselves. | M (**backend**) |
| 2.6 | **Lesson-to-objective linking in bulk** from the curriculum page | Today a teacher links one lesson at a time; competency tracking only works once lessons are linked. | S |
| 2.7 | **Timetable editor** for school admins | Timetables are read-only in the UI; schools need to set them up without the API. | M |
| 2.8 | **Export to CSV** for learners, fees and attendance | Admins share data with boards and auditors in spreadsheets. | S |
| 2.9 | **Offline-first lessons** (cache assigned lessons + quiz answers queue) for low-connectivity schools | Quizzes already work offline; extending this to lesson reading makes shared tablets usable without Wi-Fi. | M |

## 3. Quality and maintainability

| # | Item | Why | Size |
| --- | --- | --- | --- |
| 3.1 | Replace `cn` with `clsx` + `tailwind-merge` | The kit now resolves width/padding overrides on inputs itself (`controlClass`), but other components still can't override conflicting classes. | S |
| 3.2 | Move remaining `text-purple-*` classes to semantic tokens (`text-fg`, `text-fg-muted`…) | Lets `styles/theme-remaps.css` be deleted and makes themes predictable. Do it screen by screen. | M |
| 3.3 | Generate API types from the backend's OpenAPI spec | Today types in each `api.ts` are hand-written; a generator catches contract drift (like 1.2) at build time. | M |
| 3.4 | Add Playwright journeys for the new admin flows (classes → attendance, fee setup → bill → pay, curriculum → link lesson → learner competency) | The scratch smoke run passed; checking these flows in CI keeps them from breaking. | S |
| 3.5 | Role-based route guard in the app shell | Pages rely on the backend's 403s; a guard would show a friendly "not for your role" page instead of empty data when someone types a URL. | S |
| 3.6 | Tailwind v4 migration | See ARCHITECTURE.md §8. | M |

## 4. Product ideas

- **Teacher "today" view**: one screen with today's timetable, registers still to mark, classwork to
  mark and learners flagged by support signals.
- **Learner goals**: let a learner pick a weekly goal (e.g. 3 lessons) and celebrate when they hit it,
  using the existing celebration component.
- **Parent–teacher meeting booking** on the shared calendar (replaces the old "Schedule & meetings"
  placeholder).
- **Device check-in**: when a learner signs in on a registered tablet, record `lastSeenAt` so admins
  can find unused or missing devices.
- **County / government dashboard** with anonymised attendance and competency trends (the
  `/government` page is already a placeholder).

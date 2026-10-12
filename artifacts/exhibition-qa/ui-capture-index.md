{
  "journeys": [
    { "journey": "Login and authentication", "route": "/login", "viewport": "1366x900", "status": "PASS", "evidence": ["01-login.png", "full-page/01-login.png"] },
    { "journey": "Learner dashboard", "route": "/student-home", "viewport": "1366x900", "status": "PASS", "evidence": ["02-learner-dashboard.png"] },
    { "journey": "Learner lessons list", "route": "/student-lessons", "viewport": "1366x900", "status": "PASS", "evidence": ["03-learner-my-lessons.png"] },
    { "journey": "Learning activity (lesson reading)", "route": "/lesson/:id (seeded Water Cycle)", "viewport": "1366x900", "status": "PASS", "evidence": ["04-lesson-reading.png"], "notes": "Water Cycle lesson served by real backend; AI adaptation available only when AI service reachable (mock here)" },
    { "journey": "Learner progress (Support Signals + charts)", "route": "/progress", "viewport": "1366x900", "status": "PASS", "evidence": ["05-learner-progress.png"] },
    { "journey": "Accessibility settings", "route": "/dashboard/settings", "viewport": "1366x900", "status": "PASS", "evidence": ["06-accessibility-settings.png"] },
    { "journey": "How I Learn (learner preferences)", "route": "/learner/preferences", "viewport": "1366x900", "status": "PASS", "evidence": ["07-learner-how-i-learn.png"] },
    { "journey": "Teacher dashboard", "route": "/teacher", "viewport": "1366x900", "status": "PASS", "evidence": ["08-teacher-dashboard.png"] },
    { "journey": "Teacher students (class view)", "route": "/teacher/students", "viewport": "1366x900", "status": "PASS", "evidence": ["09-teacher-students.png"] },
    { "journey": "Teacher assignments", "route": "/teacher-assignments", "viewport": "1366x900", "status": "PASS", "evidence": ["10-teacher-assignments.png"] },
    { "journey": "Attendance", "route": "/attendance", "viewport": "1366x900", "status": "PASS", "evidence": ["11-teacher-attendance.png"] },
    { "journey": "Support Signals", "route": "/teacher/support", "viewport": "1366x900", "status": "PASS", "evidence": ["12-teacher-support-signals.png"], "notes": "Duplicate sidebar fixed; verified live (asides=1)" },
    { "journey": "Teacher progress", "route": "/teacher/progress", "viewport": "1366x900", "status": "PASS", "evidence": ["13-teacher-progress.png"] },
    { "journey": "Guardian dashboard", "route": "/guardian", "viewport": "1366x900", "status": "PASS", "evidence": ["14-guardian-dashboard.png"] },
    { "journey": "Guardian child progress", "route": "/guardian/wards", "viewport": "1366x900", "status": "PASS", "evidence": ["15-guardian-child.png"] },
    { "journey": "Guardian reports", "route": "/guardian/reports", "viewport": "1366x900", "status": "PASS", "evidence": ["16-guardian-reports.png"] },
    { "journey": "Guardian-to-teacher messaging", "route": "/guardian/communication", "viewport": "1366x900", "status": "PASS", "evidence": ["17-guardian-communication.png", "18-guardian-message-sent.png"] },
    { "journey": "Teacher communication (reply side)", "route": "/teacher/communication", "viewport": "1366x900", "status": "PASS", "evidence": ["19-teacher-communication.png"] },
    { "journey": "Mobile learner dashboard", "route": "/student-home", "viewport": "390x844", "status": "PASS", "evidence": ["mobile/20-mobile-learner-dashboard.png"] },
    { "journey": "Mobile learner progress", "route": "/progress", "viewport": "390x844", "status": "PASS", "evidence": ["mobile/21-mobile-learner-progress.png"] },
    { "journey": "Mobile guardian dashboard", "route": "/guardian", "viewport": "390x844", "status": "PASS", "evidence": ["mobile/22-mobile-guardian-dashboard.png"] },
    { "journey": "Mobile guardian messages", "route": "/guardian/communication", "viewport": "390x844", "status": "PASS", "evidence": ["mobile/23-mobile-guardian-messages.png"] },
    { "journey": "Mobile teacher attendance", "route": "/attendance", "viewport": "390x844", "status": "PASS", "evidence": ["mobile/24-mobile-teacher-attendance.png"] }
  ],
  "console_errors": {
    "learner": ["2x 401 before auth (loading probes before login round-trip; not user-visible)"],
    "teacher": ["2x 401 before auth (same pattern)"],
    "guardian": ["2x 401 before auth (same pattern)"],
    "messaging": ["2x 401 before auth (same pattern)"],
    "mobile": ["2x 401 before auth (same pattern)"]
  },
  "not_captured": {
    "school-administrator dashboard": "No seeded SCHOOL_ADMIN demo password available (admin@elekeza.app password differs from archive docs and returns 401). Route /admin exists but cannot be captured without an account. Fallback: register a school live to create a SCHOOL_ADMIN.",
    "AI-assisted learning recovery": "AI service is healthy at :8001 (mock/real). Recovery-state capture requires a forced fault path; not exercised here.",
    "orange/green/purple UI variants": "Current theme is purple-primary; guardian-trail green remaps apply by role/route. No orange variant exists in code; no explicit theme switcher route found.",
    "offline": "IndexedDB offline sync is present (offlineQueueCount helper) but this capture ran online; offline journey not exercised here."
  }
}

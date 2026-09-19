export type RoleNavItem = {
  label: string
  href: string
}

export type RoleConfig = {
  roleLabel: string
  subtitle: string
  navItems: RoleNavItem[]
}

export const guardianConfig: RoleConfig = {
  roleLabel: 'Guardian Workspace',
  subtitle: 'Support, monitor, and communicate clearly.',
  navItems: [
    { label: 'Dashboard', href: '/guardian' },
    { label: 'Progress Reports', href: '/guardian/reports' },
    { label: 'Schedule Routine', href: '/guardian/schedule' },
    { label: 'Communication', href: '/guardian/communication' },
    { label: 'Guardian Settings', href: '/guardian/settings' },
  ],
}

export const teacherConfig: RoleConfig = {
  roleLabel: 'Teacher Workspace',
  subtitle: 'Create, monitor, and intervene with clarity.',
  navItems: [
    { label: 'Dashboard', href: '/teacher' },
    { label: 'Student Management', href: '/teacher/students' },
    { label: 'Content Lessons', href: '/teacher/content' },
    { label: 'Assignments Tasks', href: '/teacher/assignments' },
    { label: 'Student Progress', href: '/teacher/progress' },
    { label: 'Communication', href: '/teacher/communication' },
  ],
}

export const adminConfig: RoleConfig = {
  roleLabel: 'Admin Workspace',
  subtitle: 'System oversight and role-based governance.',
  navItems: [
    { label: 'Dashboard', href: '/admin' },
    { label: 'User Management', href: '/admin/users' },
    { label: 'Class Management', href: '/admin/classes' },
    { label: 'System Settings', href: '/admin/system-settings' },
    { label: 'Reports Analytics', href: '/admin/reports' },
    { label: 'Security Permissions', href: '/admin/security' },
  ],
}


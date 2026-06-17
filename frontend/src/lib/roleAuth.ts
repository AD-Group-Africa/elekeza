import { User } from '@/types'

export type DemoRoleAccount = {
  email: string
  password: string
  role: User['role']
  homePath: string
}

const DEMO_ROLE_ACCOUNTS: DemoRoleAccount[] = [
  {
    email: 'student@elekeza.org',
    password: 'student@123',
    role: 'Student',
    homePath: '/student-home',
  },
  {
    email: 'admin@elekeza.org',
    password: 'admin@123',
    role: 'School Admin',
    homePath: '/admin',
  },
  {
    email: 'teacher@elekeza.org',
    password: 'teacher@123',
    role: 'Teacher',
    homePath: '/teacher',
  },
  {
    email: 'guardian@elekeza.org',
    password: 'guardian@123',
    role: 'Guardian',
    homePath: '/guardian',
  },
  {
    email: 'parent@elekeza.org',
    password: 'parent@123',
    role: 'Guardian',
    homePath: '/guardian',
  },
]

const normalize = (value: string) => value.trim().toLowerCase()

export function getDemoRoleAccountByCredentials(email: string, password: string) {
  const normalizedEmail = normalize(email)
  return DEMO_ROLE_ACCOUNTS.find(
    (account) => account.email === normalizedEmail && account.password === password
  )
}

export function getDemoRoleAccountByEmail(email: string) {
  const normalizedEmail = normalize(email)
  return DEMO_ROLE_ACCOUNTS.find((account) => account.email === normalizedEmail)
}

export function isReservedRoleEmail(email: string) {
  return Boolean(getDemoRoleAccountByEmail(email))
}

export function getHomePathForRole(role: User['role']) {
  if (role === 'School Admin') return '/admin'
  if (role === 'Teacher') return '/teacher'
  if (role === 'Guardian') return '/guardian'
  return '/dashboard'
}


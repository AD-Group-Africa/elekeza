'use client'

import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react'
import { authAPI } from '@/lib/api'
import { AuthResponse, CognitiveProfile, User } from '@/types'
import { getDemoRoleAccountByCredentials } from '@/lib/roleAuth'
import { persistCognitiveProfiles, readCognitiveProfiles } from '@/lib/cognitiveProfiles'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (email: string, password: string, fullName: string, cognitiveProfiles?: CognitiveProfile[]) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const DEMO_USER_STORAGE_KEY = 'docuease-demo-user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const mapAuthResponseToUser = (data: AuthResponse): User => ({
    id: data.learnerId,
    email: data.email,
    name: data.name || '',
    onboardingComplete: data.onboardingComplete,
    role: 'Student',
    cognitiveProfiles:
        data.cognitiveProfiles && data.cognitiveProfiles.length > 0
            ? data.cognitiveProfiles
            : readCognitiveProfiles(data.learnerId),
  })

  const checkAuth = useCallback(async () => {
    // Restore demo user if present
    if (typeof window !== 'undefined') {
      const demoUserRaw = localStorage.getItem(DEMO_USER_STORAGE_KEY)
      if (demoUserRaw) {
        try {
          const parsed = JSON.parse(demoUserRaw) as User
          setUser(parsed)
          setLoading(false)
          return
        } catch {
          localStorage.removeItem(DEMO_USER_STORAGE_KEY)
        }
      }
    }

    try {
      // Refresh token using the HTTP‑only cookie (no arguments)
      const res = await authAPI.refresh()
      const data: AuthResponse = res.data
      setUser(mapAuthResponseToUser(data))
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const login = async (email: string, password: string): Promise<User> => {
    // Demo account shortcut
    const demoAccount = getDemoRoleAccountByCredentials(email, password)
    if (demoAccount) {
      const demoUser: User = {
        id: `demo-${demoAccount.role.toLowerCase().replace(/\s+/g, '-')}`,
        email: demoAccount.email,
        name: demoAccount.role,
        onboardingComplete: true,
        role: demoAccount.role,
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(demoUser))
      }
      setUser(demoUser)
      return demoUser
    }

    // Clear any stale demo user
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DEMO_USER_STORAGE_KEY)
    }

    const res = await authAPI.login(email, password)
    const data: AuthResponse = res.data
    const mappedUser = mapAuthResponseToUser(data)
    setUser(mappedUser)
    return mappedUser
  }

  const register = async (
      email: string,
      password: string,
      fullName: string,
      cognitiveProfiles: CognitiveProfile[] = []
  ): Promise<User> => {
    const res = await authAPI.register({ email, password, fullName, cognitiveProfiles })
    const data: AuthResponse = res.data

    if (data.learnerId && cognitiveProfiles.length > 0) {
      persistCognitiveProfiles(data.learnerId, cognitiveProfiles)
    }

    const mappedUser = mapAuthResponseToUser(data)
    setUser(mappedUser)
    return mappedUser
  }

  const logout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DEMO_USER_STORAGE_KEY)
    }

    try {
      await authAPI.logout()
    } catch {
      // Ignore errors – token might already be expired.
    } finally {
      setUser(null)
    }
  }

  return (
      <AuthContext.Provider value={{ user, loading, login, register, logout }}>
        {children}
      </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

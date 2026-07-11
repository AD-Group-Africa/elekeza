'use client'

import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { authAPI } from '@/lib/api'
import { AuthResponse, CognitiveProfile, User } from '@/types'
import { persistCognitiveProfiles, readCognitiveProfiles } from '@/lib/cognitiveProfiles'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (email: string, password: string, fullName: string, cognitiveProfiles?: CognitiveProfile[]) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const mapToUser = (data: AuthResponse): User => ({
    id: String(data.learnerId),
    email: data.email,
    name: data.name ?? '',
    onboardingComplete: data.onboardingComplete,
    role: data.role ?? 'STUDENT',
    cognitiveProfiles:
      data.cognitiveProfiles?.length
        ? data.cognitiveProfiles
        : readCognitiveProfiles(data.learnerId),
  })

  // Only restore session; no automatic redirect
  const checkAuth = useCallback(async () => {
    try {
      const res = await authAPI.me()
      const mapped = mapToUser(res.data as AuthResponse)
      setUser(mapped)
    } catch {
      try {
        const refreshRes = await authAPI.refresh()
        const mapped = mapToUser(refreshRes.data as AuthResponse)
        setUser(mapped)
      } catch {
        setUser(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { checkAuth() }, [checkAuth])

  const login = async (email: string, password: string): Promise<User> => {
    const res = await authAPI.login(email, password)
    const data = res.data as AuthResponse
    if (data.accessToken) {
      sessionStorage.setItem('elekeza_access', data.accessToken)
    }
    const mapped = mapToUser(data)
    setUser(mapped)
    return mapped
  }

  const register = async (
    email: string,
    password: string,
    fullName: string,
    cognitiveProfiles: CognitiveProfile[] = []
  ): Promise<User> => {
    const res = await authAPI.register({ email, password, name: fullName, cognitiveProfiles })
    const data = res.data as AuthResponse
    if (data.learnerId && cognitiveProfiles.length > 0) {
      persistCognitiveProfiles(data.learnerId, cognitiveProfiles)
    }
    if (data.accessToken) {
      sessionStorage.setItem('elekeza_access', data.accessToken)
    }
    const mapped = mapToUser(data)
    setUser(mapped)
    return mapped
  }

  const logout = async () => {
    try { await authAPI.logout() } catch {}
    sessionStorage.removeItem('elekeza_access')
    setUser(null)
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

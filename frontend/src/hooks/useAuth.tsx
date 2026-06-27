'use client'

import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react'
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
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const mapAuthResponseToUser = (data: AuthResponse): User => ({
    id: String(data.learnerId),
    email: data.email,
    name: data.name || '',
    onboardingComplete: data.onboardingComplete,
    role: data.role || 'Student',
    cognitiveProfiles:
      data.cognitiveProfiles && data.cognitiveProfiles.length > 0
        ? data.cognitiveProfiles
        : readCognitiveProfiles(data.learnerId),
  })

  const checkAuth = useCallback(async () => {
    try {
      const res = await authAPI.refresh()
      const data = res.data
      setUser(mapAuthResponseToUser(data))
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { checkAuth() }, [checkAuth])

  const login = async (email: string, password: string): Promise<User> => {
    const res = await authAPI.login(email, password)
    const data = res.data
    const mappedUser = mapAuthResponseToUser(data)
    setUser(mappedUser)
    return mappedUser
  }

  const register = async (email: string, password: string, fullName: string, cognitiveProfiles: CognitiveProfile[] = []) => {
    const res = await authAPI.register({ email, password, fullName, cognitiveProfiles })
    const data = res.data
    if (data.learnerId && cognitiveProfiles.length > 0) {
      persistCognitiveProfiles(data.learnerId, cognitiveProfiles)
    }
    const mappedUser = mapAuthResponseToUser(data)
    setUser(mappedUser)
    return mappedUser
  }

  const logout = async () => {
    try { await authAPI.logout() } catch {}
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

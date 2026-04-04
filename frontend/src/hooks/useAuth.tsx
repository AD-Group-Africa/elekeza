'use client'

import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react'
import { authAPI } from '@/lib/api'
import { AuthResponse, User } from '@/types'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const mapAuthResponseToUser = (data: AuthResponse): User => ({
    id: data.learnerId,
    email: data.email,
    fullName: data.fullName || '',
    onboardingComplete: data.onboardingComplete,
    role: 'Student',
  })

  const checkAuth = useCallback(async () => {
    try {
      // Try to refresh - if it succeeds, backend returns learner data.
      const data = await authAPI.refresh()
      setUser(mapAuthResponseToUser(data))
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // On app load, try to refresh token to check if logged in
    checkAuth()
  }, [checkAuth])

  const login = async (email: string, password: string) => {
    const data = await authAPI.login(email, password)
    setUser(mapAuthResponseToUser(data))
  }

  const register = async (email: string, password: string, fullName: string) => {
    const data = await authAPI.register(email, password, fullName)
    setUser(mapAuthResponseToUser(data))
  }

  const logout = async () => {
    try {
      await authAPI.logout()
    } catch {
      // Even if backend logout fails (expired token, network), clear local auth state.
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

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
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const mapToUser = (data: AuthResponse): User => ({
    id:                 String(data.learnerId),
    email:              data.email,
    name:               data.name ?? '',
    onboardingComplete: data.onboardingComplete,
    role:               data.role ?? 'STUDENT',
    cognitiveProfiles:
      data.cognitiveProfiles?.length
        ? data.cognitiveProfiles
        : readCognitiveProfiles(data.learnerId),
  })

  // On mount: try /auth/me (uses HttpOnly access-token cookie set by login).
  // Falls back cleanly if not authenticated â€” no error thrown to console.
    const checkAuth = useCallback(async () => {
    try {
      const res = await authAPI.me();
      const mapped = mapToUser(res.data as AuthResponse);
      setUser(mapped);
      // Redirect if on login/register/root page
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (path === '/login' || path === '/register' || path === '/') {
          switch (mapped.role) {
            case 'TEACHER':
            case 'SCHOOL_ADMIN':
              router.push('/teacher');
              break;
            case 'GUARDIAN':
              router.push('/guardian');
              break;
            case 'ADMIN':
              router.push('/admin');
              break;
            default:
              router.push('/student-home');
          }
        }
      }
    } catch {
      try {
        const refreshRes = await authAPI.refresh();
        const mapped = mapToUser(refreshRes.data as AuthResponse);
        setUser(mapped);
        if (typeof window !== 'undefined') {
          const path = window.location.pathname;
          if (path === '/login' || path === '/register' || path === '/') {
            switch (mapped.role) {
              case 'TEACHER':
              case 'SCHOOL_ADMIN':
                router.push('/teacher');
                break;
              case 'GUARDIAN':
                router.push('/guardian');
                break;
              case 'ADMIN':
                router.push('/admin');
                break;
              default:
                router.push('/student-home');
            }
          }
        }
      } catch {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { checkAuth() }, [checkAuth])

  const login = async (email: string, password: string): Promise<User> => {
    const res  = await authAPI.login(email, password)
    const data = res.data as AuthResponse
    // Backend sets HttpOnly cookies; also store accessToken in memory for
    // Authorization header on non-cookie requests
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
    const res  = await authAPI.register({ email, password, name: fullName, cognitiveProfiles })
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




'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { roleHome } from '@/lib/roles';

export interface User {
  learnerId: number;
  email: string;
  name: string;
  role: string;
  title?: string;
  gender?: string;
  cognitiveProfiles?: string[];
  /** Tenant context for admin surfaces (staff management, CSV import). */
  institutionId?: number;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
  gender?: string;
  termsAccepted: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /** Signs in. Navigates to the role's home unless `redirect` is false. */
  login: (email: string, password: string, options?: { redirect?: boolean }) => Promise<User>;
  /** Creates a learner account and signs in, without navigating. */
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    void api.get('/auth/csrf').finally(() => {
      api.get('/auth/me').then(res => setUser(res.data)).catch(() => undefined).finally(() => setLoading(false));
    });
  }, []);

  const login = useCallback(async (email: string, password: string, options?: { redirect?: boolean }) => {
    const res = await api.post('/auth/login', { email, password });
    const userData = res.data as User;
    setUser(userData);
    if (options?.redirect !== false) router.push(roleHome(userData.role));
    return userData;
  }, [router]);

  const register = useCallback(async (input: RegisterInput) => {
    // Public sign-up always creates a learner account (the backend has no
    // role field); staff accounts are created by the school.
    await api.post('/auth/register', input);
    return login(input.email, input.password, { redirect: false });
  }, [login]);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* signing out locally anyway */ }
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

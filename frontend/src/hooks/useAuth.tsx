'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';

interface User {
  learnerId: number;
  email: string;
  name: string;
  role: string;
  title?: string;
  gender?: string;
  cognitiveProfiles?: string[];
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, name: string, phone: string, role: string, termsAccepted: boolean, gender?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    void api.get('/auth/csrf').finally(() => {
      api.get('/auth/me').then(res => setUser(res.data)).catch(() => undefined).finally(() => setLoading(false));
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const userData = res.data;
    setUser(userData);
    switch (userData.role) {
      case 'TEACHER': router.push('/teacher'); break;
      case 'STUDENT': router.push('/student-home'); break;
      case 'GUARDIAN': router.push('/guardian'); break;
      case 'SCHOOL_ADMIN':
      case 'ADMIN': router.push('/admin'); break;
      default: router.push('/student-home');
    }
    return userData;
  }, [router]);

  const register = useCallback(async (email: string, password: string, name: string, phone: string, role: string, termsAccepted: boolean, gender?: string) => {
    await api.post('/auth/register', { email, password, name, phone, termsAccepted, gender });
    await login(email, password);
  }, [login]);

  const loginWithGoogle = useCallback(async () => {
    // Google Sign-In will be available in a future release;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch {}
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, login, register, loginWithGoogle, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);



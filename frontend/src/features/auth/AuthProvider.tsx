'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { roleHome } from '@/lib/roles';
import { authApi } from './api';
import type { RegisterInput, User } from './types';

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
  const queryClient = useQueryClient();

  useEffect(() => {
    void authApi
      .csrf()
      .catch(() => undefined)
      .finally(() => {
        authApi
          .me()
          .then(setUser)
          .catch(() => undefined)
          .finally(() => setLoading(false));
      });
  }, []);

  const login = useCallback(
    async (email: string, password: string, options?: { redirect?: boolean }) => {
      const signedIn = await authApi.login(email, password);
      queryClient.clear(); // never show a previous user's cached data
      setUser(signedIn);
      if (options?.redirect !== false) router.push(roleHome(signedIn.role));
      return signedIn;
    },
    [router, queryClient],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      // Public sign-up always creates a learner account (the backend has no
      // role field); staff accounts are created by the school.
      await authApi.register(input);
      return login(input.email, input.password, { redirect: false });
    },
    [login],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* signing out locally anyway */
    }
    queryClient.clear();
    setUser(null);
    router.push('/login');
  }, [router, queryClient]);

  const value = useMemo(() => ({ user, login, register, logout, loading }), [user, login, register, logout, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

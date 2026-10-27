'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/features/auth';
import { AccessibilitySettingsProvider, RolePaletteSync } from '@/features/accessibility';
import { getErrorStatus } from '@/lib/api';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is per-user and changes slowly; avoid surprise refetches while
        // learners are reading, but never serve hours-old numbers.
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Retry once for network blips and server errors; a 4xx (forbidden,
        // not found, invalid) will not succeed on retry, so show it at once.
        retry: (failureCount, error) => {
          const status = getErrorStatus(error);
          return failureCount < 1 && !(status && status >= 400 && status < 500);
        },
      },
    },
  });
}

/** Every client-side provider the app needs, in one place. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AccessibilitySettingsProvider>
          <RolePaletteSync />
          {children}
        </AccessibilitySettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

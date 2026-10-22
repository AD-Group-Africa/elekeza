'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

/**
 * Legacy /exam route — the real experiences are role-specific:
 * students go to /student-exams, staff to /teacher/exams.
 */
export default function LegacyExamRedirect() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else router.replace(user.role === 'STUDENT' ? '/student-exams' : '/teacher/exams');
  }, [loading, user, router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <p className="text-purple-300" role="status">Taking you to Exams…</p>
    </div>
  );
}

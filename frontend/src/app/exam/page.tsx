'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy /exam route — the real experiences are role-specific:
 * students go to /student-exams, staff to /teacher/exams.
 */
export default function Page() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    import('@/lib/axios').then(({ default: api }) => {
      api.get('/auth/me')
        .then(res => {
          if (cancelled) return;
          const role = res.data?.role;
          if (role === 'STUDENT') router.replace('/student-exams');
          else if (role) router.replace('/teacher/exams');
          else router.replace('/login');
        })
        .catch(() => { if (!cancelled) router.replace('/login'); });
    });
    return () => { cancelled = true; };
  }, [router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <p className="text-purple-300" role="status">Taking you to Exams…</p>
    </div>
  );
}



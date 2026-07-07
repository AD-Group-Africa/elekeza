'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface Lesson {
  id: number;
  title: string;
  score?: number;
  completed?: boolean;
}

export default function StudentHome() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [lessons, setLessons]  = useState<Lesson[]>([]);
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }

    // Fetch assigned lessons (not all content — only what this student is assigned)
    api.get('/progress/lessons')
      .then(res => setLessons(Array.isArray(res.data) ? res.data : []))
      .catch(() => setLessons([]))
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  if (authLoading || loading) return (
    <SidebarLayout>
      <div className="text-white text-center mt-20 animate-pulse">Loading your lessons…</div>
    </SidebarLayout>
  );

  const pending   = lessons.filter(l => !l.completed);
  const completed = lessons.filter(l => l.completed);

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Hello, {user?.name?.split(' ')[0] ?? 'Learner'} 👋
        </h1>
        <p className="text-blue-200 mt-1">
          {pending.length > 0
            ? `You have ${pending.length} lesson${pending.length === 1 ? '' : 's'} to complete.`
            : completed.length > 0
              ? 'All lessons complete — great work!'
              : 'Your teacher will assign lessons soon.'}
        </p>
      </div>

      {/* Pending lessons */}
      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-blue-100 mb-3">Your lessons</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pending.map(lesson => (
              <div
                key={lesson.id}
                className="card cursor-pointer hover:shadow-xl transition border-l-4 border-purple-400"
                onClick={() => router.push(`/lesson/${lesson.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && router.push(`/lesson/${lesson.id}`)}
                aria-label={`Start lesson: ${lesson.title}`}
              >
                <h2 className="text-xl font-semibold text-blue-900 mb-2">{lesson.title}</h2>
                <p className="text-purple-600 text-sm font-medium">Start reading →</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Completed lessons */}
      {completed.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-blue-100 mb-3">Completed</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completed.map(lesson => (
              <div
                key={lesson.id}
                className="card flex items-center justify-between cursor-pointer hover:shadow-md transition opacity-80"
                onClick={() => router.push(`/lesson/${lesson.id}`)}
              >
                <div>
                  <h3 className="font-medium text-blue-900">{lesson.title}</h3>
                  {lesson.score != null && (
                    <p className="text-sm text-gray-500">Score: {Math.round(lesson.score)}%</p>
                  )}
                </div>
                <span className="text-2xl">✅</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {lessons.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-5xl mb-4">📚</div>
          <p className="text-gray-600 text-lg">No lessons assigned yet.</p>
          <p className="text-gray-400 text-sm mt-2">Ask your teacher to assign a lesson.</p>
        </div>
      )}
    </SidebarLayout>
  );
}

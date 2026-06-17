'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function StudentHome() {
  const router = useRouter();
  const [lastLesson, setLastLesson] = useState<any>(null);

  useEffect(() => {
    api.get('/api/progress/dashboard')
      .then((res) => {
        if (res.data?.lastLesson) setLastLesson(res.data.lastLesson);
      })
      .catch(() => {});
  }, []);

  const openLesson = () => {
    if (lastLesson?.id) {
      router.push(`/lesson/${lastLesson.id}`);
    } else {
      router.push('/dashboard/history');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-900 via-white to-indigo-500 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-blue-900 mb-6">Welcome, Learner</h1>
        <button
          onClick={openLesson}
          className="bg-indigo-500 text-white text-2xl font-semibold py-6 px-12 rounded-2xl shadow-lg active:scale-95 transition min-w-[240px]"
          aria-label="Continue your lesson"
        >
          📖 Continue Learning
        </button>
        {lastLesson && (
          <p className="mt-4 text-gray-600 text-lg">{lastLesson.title}</p>
        )}
        <button
          onClick={() => router.push('/dashboard/history')}
          className="mt-8 text-indigo-500 underline text-sm"
        >
          View past lessons
        </button>
      </div>
    </main>
  );
}

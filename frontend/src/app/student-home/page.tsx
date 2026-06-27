'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';

export default function StudentHome() {
  const router = useRouter();
  const [progress, setProgress] = useState<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem('elekeza-progress');
    if (saved) setProgress(JSON.parse(saved));
  }, []);

  const openLesson = () => router.push('/lesson/demo-lesson');

  return (
    <SidebarLayout>
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <div className="card bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h1 className="text-3xl font-bold text-blue-900 mb-6">Welcome, Learner</h1>
          <button onClick={openLesson} className="btn-primary text-2xl py-6 px-12 w-full">
            📖 Continue Learning
          </button>
          <p className="mt-4 text-gray-600 text-lg">The Water Cycle</p>
          {progress?.['demo-lesson'] && (
            <p className="mt-2 text-green-600 font-semibold">
              ✅ Completed – Score: {progress['demo-lesson'].score}%
            </p>
          )}
          <button
            onClick={() => router.push('/dashboard/history')}
            className="mt-8 text-purple-600 underline text-sm"
          >
            View past lessons
          </button>
        </div>
      </div>
    </SidebarLayout>
  );
}

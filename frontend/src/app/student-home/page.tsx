'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';

export default function StudentHome() {
  const router = useRouter();
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/content/list')
      .then(res => setLessons(res.data))
      .catch(() => setLessons([{ id: 1, title: 'The Water Cycle' }]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SidebarLayout><div className="text-white text-center mt-20">Loading your lessons...</div></SidebarLayout>;

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Welcome, Learner</h1>
      </div>
      {lessons.length === 0 ? (
        <div className="card text-center">
          <p className="text-gray-600">No lessons available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lessons.map((lesson: any) => (
            <div
              key={lesson.id}
              className="card cursor-pointer hover:shadow-xl transition"
              onClick={() => router.push(`/lesson/${lesson.id}`)}
            >
              <h2 className="text-xl font-semibold text-blue-900 mb-2">{lesson.title}</h2>
              <p className="text-gray-600 text-sm">{lesson.status === 'READY' ? 'Ready to learn' : 'Processing...'}</p>
            </div>
          ))}
        </div>
      )}
    </SidebarLayout>
  );
}

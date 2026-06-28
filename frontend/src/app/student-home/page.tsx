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
    api.get('/learner/dashboard')          // or /progress/dashboard
      .then(res => {
        if (res.data?.lessons?.length) {
          setLessons(res.data.lessons);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Demo lesson always available as fallback
  const demoLesson = { id: 1, title: 'The Water Cycle' };
  const displayLessons = lessons.length > 0 ? lessons : [demoLesson];

  if (loading) return <SidebarLayout><div className="text-white">Loading...</div></SidebarLayout>;

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Welcome, Learner</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {displayLessons.map((lesson: any) => (
          <div key={lesson.id} className="card cursor-pointer hover:shadow-xl transition"
               onClick={() => router.push(`/lesson/${lesson.id}`)}>
            <h2 className="text-xl font-semibold text-blue-900 mb-2">{lesson.title}</h2>
            <p className="text-gray-600">Tap to start reading</p>
          </div>
        ))}
      </div>
    </SidebarLayout>
  );
}

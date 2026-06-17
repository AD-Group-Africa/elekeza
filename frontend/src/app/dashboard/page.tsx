'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (user) {
      api.get(`/api/progress/dashboard?learnerId=${user.id}`)
        .then((res) => setData(res.data))
        .catch(() => setData({ recentLessons: [], quizHistory: [] }));
    }
  }, [user]);

  if (!user) return <div className="p-6">Please log in.</div>;
  if (!data) return <div className="p-6">Loading dashboard...</div>;

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-900 via-white to-indigo-500 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-blue-900 mb-8">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="font-semibold text-lg text-blue-900">Recent Lessons</h2>
            {data.recentLessons?.map((lesson: any) => (
              <p key={lesson.id} className="text-gray-600 mt-2">{lesson.title} – {lesson.status}</p>
            ))}
          </div>
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="font-semibold text-lg text-blue-900">Quiz History</h2>
            {data.quizHistory?.map((quiz: any) => (
              <p key={quiz.id} className="text-gray-600 mt-2">{quiz.lessonTitle} – Score: {quiz.score}%</p>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

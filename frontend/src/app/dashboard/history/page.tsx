'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function HistoryPage() {
  const [lessons, setLessons] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/content/history')
      .then((res) => setLessons(res.data || []))
      .catch(() => setLessons([]));
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-900 via-white to-indigo-500 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-blue-900 mb-8">History</h1>
        {lessons.map((lesson: any) => (
          <div key={lesson.id} className="bg-white rounded-2xl shadow p-4 mb-4">
            <p className="font-semibold text-blue-900">{lesson.title}</p>
            <p className="text-sm text-green-600">Score: {lesson.score}% – Completed</p>
          </div>
        ))}
      </div>
    </main>
  );
}

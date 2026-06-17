'use client';

import { useEffect, useState } from 'react';

export default function HistoryPage() {
  const [lessons, setLessons] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('elekeza-progress');
    if (saved) {
      const progress = JSON.parse(saved);
      setLessons([
        { id: 'demo-lesson', title: 'The Water Cycle', score: progress['demo-lesson']?.score, date: progress['demo-lesson']?.date }
      ]);
    }
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-900 via-white to-indigo-500 p-6" role="main" aria-label="Document history">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-blue-900 mb-8">History</h1>
        {lessons.map(lesson => (
          <div key={lesson.id} className="bg-white rounded-2xl shadow p-4 mb-4">
            <p className="font-semibold text-blue-900">{lesson.title}</p>
            {lesson.score !== undefined ? (
              <p className="text-sm text-green-600">Score: {lesson.score}% – Completed</p>
            ) : (
              <p className="text-sm text-gray-500">Not yet completed</p>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

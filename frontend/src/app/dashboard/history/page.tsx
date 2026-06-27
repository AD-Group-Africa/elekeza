'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SidebarLayout from '@/components/layout/SidebarLayout';

export default function HistoryPage() {
  const [lessons, setLessons] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem('elekeza-progress');
    if (saved) {
      const progress = JSON.parse(saved);
      const lessonData = [];
      if (progress['demo-lesson']) {
        lessonData.push({
          id: 'demo-lesson',
          title: 'The Water Cycle',
          score: progress['demo-lesson'].score,
          date: progress['demo-lesson'].date,
        });
      }
      setLessons(lessonData);
    }
  }, []);

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">History</h1>
      </div>

      {lessons.length === 0 ? (
        <div className="card bg-white rounded-2xl p-8 text-center">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-xl font-semibold text-blue-900 mb-2">
            No lessons yet
          </h2>
          <p className="text-gray-600 mb-6">
            You haven&apos;t taken any lessons. Start your first one now!
          </p>
          <button onClick={() => router.push('/student-home')} className="btn-primary">
            Start a Lesson
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {lessons.map((lesson: any) => (
            <div
              key={lesson.id}
              className="card bg-white rounded-2xl p-6 flex justify-between items-center cursor-pointer hover:bg-blue-50 transition"
              onClick={() => router.push(`/lesson/${lesson.id}`)}
            >
              <div>
                <p className="font-semibold text-blue-900">{lesson.title}</p>
                <p className="text-sm text-gray-500">
                  Completed: {new Date(lesson.date).toLocaleDateString()}
                </p>
              </div>
              {lesson.score !== undefined && (
                <span className="text-lg font-bold text-purple-600">{lesson.score}%</span>
              )}
            </div>
          ))}
        </div>
      )}
    </SidebarLayout>
  );
}

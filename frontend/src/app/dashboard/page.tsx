'use client';

import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';

interface DashboardProgress {
  completedCount: number;
  averageScore: number;
}

interface LessonRow {
  id: number;
  title: string;
  status: string;
}

export default function StudentDashboard() {
  const [progress, setProgress] = useState<DashboardProgress | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);

  useEffect(() => {
    api.get('/progress/dashboard')
      .then(res => setProgress(res.data))
      .catch(() => {});

    api.get('/content/list')
      .then(res => setLessons(res.data))
      .catch(() => {});
  }, []);

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Your Progress</h1>
      </div>

      {progress ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card text-center">
            <p className="text-4xl font-bold text-purple-600">{progress.completedCount}</p>
            <p className="text-purple-300">Lessons Completed</p>
          </div>
          <div className="card text-center">
            <p className="text-4xl font-bold text-purple-600">{progress.averageScore}%</p>
            <p className="text-purple-300">Average Score</p>
          </div>
          <div className="card text-center">
            <p className="text-4xl font-bold text-purple-600">{lessons.length}</p>
            <p className="text-purple-300">Available Lessons</p>
          </div>
        </div>
      ) : (
        <div className="card text-center mb-8">
          <p className="text-gray-600">Complete your first quiz to see progress.</p>
        </div>
      )}

      <h2 className="text-2xl font-bold text-white mb-4">Recent Lessons</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lessons.map((lesson: LessonRow) => (
          <div key={lesson.id} className="card cursor-pointer hover:shadow-xl transition"
               onClick={() => window.location.href = `/lesson/${lesson.id}`}>
            <h3 className="text-lg font-semibold text-blue-900">{lesson.title}</h3>
            <p className="text-sm text-purple-300 mt-1">{lesson.status === 'READY' ? 'Ready' : 'Processing'}</p>
          </div>
        ))}
      </div>
    </SidebarLayout>
  );
}



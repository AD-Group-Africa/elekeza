'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [progress, setProgress] = useState<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem('elekeza-progress');
    if (saved) setProgress(JSON.parse(saved));
  }, []);

  const userName = user?.name || 'Learner';
  const avgScore = progress?.['demo-lesson']?.score ?? null;

  return (
    <SidebarLayout>
      {/* Display Modes Bar */}
      <div className="card mb-6 flex items-center justify-between flex-wrap gap-2">
        <span className="text-gray-600 font-medium text-sm">Display Modes:</span>
        <div className="flex gap-3">
          <button className="px-4 py-1 rounded-full bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition">Calm UI</button>
          <button className="px-4 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-medium hover:bg-purple-200 transition">Focus Mode</button>
        </div>
      </div>

      <div className="mb-8">
        <p className="text-gray-200 text-sm">Good morning, {userName}</p>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
      </div>

      {/* Stats Cards – responsive grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="card text-center">
          <p className="text-4xl font-bold text-purple-600">
            {progress?.['demo-lesson']?.completed ? 1 : 0}
          </p>
          <p className="text-gray-500 mt-1">Lessons Completed</p>
        </div>
        <div className="card text-center">
          <p className="text-4xl font-bold text-purple-600">
            {avgScore !== null ? `${avgScore}%` : 'N/A'}
          </p>
          <p className="text-gray-500 mt-1">Average Quiz Score</p>
        </div>
        <div className="card text-center">
          <p className="text-4xl font-bold text-purple-600">1</p>
          <p className="text-gray-500 mt-1">Quiz Attempted</p>
        </div>
      </div>

      {/* Recent Lessons & Quiz History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">Recent Lessons</h2>
          <ul className="space-y-3">
            {[
              { title: 'The Water Cycle', status: 'Completed' },
              { title: 'Introduction to Fractions', status: 'In Progress' },
              { title: 'Photosynthesis', status: 'Not Started' },
            ].map((lesson, idx) => (
              <li key={idx} className="flex justify-between items-center cursor-pointer hover:bg-blue-50 rounded-lg px-2 py-1 transition"
                onClick={() => router.push(`/lesson/${idx + 1}`)}>
                <span className="text-gray-700">{lesson.title}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  lesson.status === 'Completed' ? 'bg-green-100 text-green-700' :
                  lesson.status === 'In Progress' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{lesson.status}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between items-center">
            <button onClick={() => router.push('/upload')} className="btn-primary">+ New Lesson</button>
            <button onClick={() => router.push('/dashboard/history')} className="btn-outline">View all lessons</button>
          </div>
        </div>
        <div className="card">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">Quiz History</h2>
          <ul className="space-y-3">
            {[
              { title: 'Water Cycle Quiz', score: 80 },
              { title: 'Fractions Quiz', score: 65 },
              { title: 'Photosynthesis Quiz', score: 90 },
            ].map((quiz, idx) => (
              <li key={idx} className="flex justify-between items-center">
                <span className="text-gray-700">{quiz.title}</span>
                <span className="text-sm font-semibold text-purple-600">{quiz.score}%</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 text-right">
            <button onClick={() => router.push('/quiz/review/latest')} className="btn-outline">Review last quiz</button>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}

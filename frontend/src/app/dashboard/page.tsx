'use client';

import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<any>(null);

  useEffect(() => {
    api.get('/progress/dashboard')
      .then(res => setProgress(res.data))
      .catch(() => {});
  }, []);

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
      </div>
      {progress ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card text-center">
            <p className="text-4xl font-bold text-purple-600">{progress.completedCount}</p>
            <p className="text-gray-500">Lessons Completed</p>
          </div>
          <div className="card text-center">
            <p className="text-4xl font-bold text-purple-600">{progress.averageScore}%</p>
            <p className="text-gray-500">Average Score</p>
          </div>
          <div className="card text-center">
            <p className="text-4xl font-bold text-purple-600">{progress.recentLessons.length}</p>
            <p className="text-gray-500">Recent Lessons</p>
          </div>
        </div>
      ) : (
        <div className="card text-center">
          <p className="text-gray-600">Complete your first lesson to see progress.</p>
        </div>
      )}
    </SidebarLayout>
  );
}

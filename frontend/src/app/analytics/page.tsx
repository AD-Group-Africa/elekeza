'use client';

import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get('/api/analytics/overview')
      .then(res => setData(res.data))
      .catch(() => {});
  }, []);

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Analytics</h1>
      </div>
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card text-center">
            <p className="text-4xl font-bold text-purple-600">{data.totalStudents}</p>
            <p className="text-gray-500">Total Students</p>
          </div>
          <div className="card text-center">
            <p className="text-4xl font-bold text-purple-600">{data.totalLessonsCompleted}</p>
            <p className="text-gray-500">Lessons Completed</p>
          </div>
          <div className="card text-center">
            <p className="text-4xl font-bold text-purple-600">{data.averageScore}%</p>
            <p className="text-gray-500">Average Score</p>
          </div>
        </div>
      )}
    </SidebarLayout>
  );
}

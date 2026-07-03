'use client';

import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';

interface Ward {
  name: string;
  completedLessons: number;
  lastQuizScore: number | null;
}

export default function ParentDashboard() {
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/guardian/wards')
      .then(res => setWards(res.data))
      .catch(() => setError('No linked children found. Ensure the backend is running and you are logged in as a guardian.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SidebarLayout><div className="text-white text-center mt-20">Loading...</div></SidebarLayout>;
  if (error) return <SidebarLayout><div className="card text-center mt-20 text-red-600">{error}</div></SidebarLayout>;

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Your Children</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {wards.length === 0 ? (
          <div className="card text-center col-span-full">
            <p className="text-gray-600">No linked children found.</p>
          </div>
        ) : (
          wards.map((w, i) => (
            <div key={i} className="card">
              <h2 className="text-xl font-semibold text-blue-900 mb-2">{w.name}</h2>
              <p className="text-gray-600">Lessons completed: {w.completedLessons}</p>
              <p className="text-gray-600">Last quiz score: {w.lastQuizScore ?? 'N/A'}</p>
            </div>
          ))
        )}
      </div>
    </SidebarLayout>
  );
}

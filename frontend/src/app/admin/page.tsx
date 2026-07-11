'use client';

import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/analytics/admin')
      .then(res => setData(res.data))
      .catch(() => setError('Unable to load admin dashboard. Is the backend running?'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <SidebarLayout>
        <div className="animate-pulse p-6">
          <div className="h-8 bg-gray-700 rounded w-1/3 mb-8"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-800 rounded-xl"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-800 rounded-xl mb-8"></div>
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-800 rounded-xl"></div>
            ))}
          </div>
        </div>
      </SidebarLayout>
    );
  }

  if (error) {
    return (
      <SidebarLayout>
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-white mb-2">Connection Error</h2>
          <p className="text-gray-400 max-w-md">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">Retry</button>
        </div>
      </SidebarLayout>
    );
  }

  if (!data) {
    return (
      <SidebarLayout>
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <div className="text-6xl mb-4">🏫</div>
          <h1 className="text-3xl font-bold text-white mb-2">No Institution Data</h1>
          <p className="text-gray-400 max-w-md">Register a school to see institution analytics.</p>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <h1 className="text-3xl font-bold text-white mb-8">Admin Dashboard</h1>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Learners', value: data.totalLearners || 0 },
          { label: 'Teachers', value: data.totalTeachers || 0 },
          { label: 'Guardians', value: data.totalGuardians || 0 },
          { label: 'Institutions', value: data.totalInstitutions || 0 },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow text-center">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-3xl font-bold text-gray-800">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Monthly Registrations Chart */}
      <div className="bg-white rounded-xl p-6 shadow mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Monthly Registrations</h2>
        {(data.monthlyRegistrations || []).length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p>No registration data yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.monthlyRegistrations || []}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip />
              <Bar dataKey="count" fill="#3B6DE5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Content Created', value: data.totalContent || 0 },
          { label: 'Quizzes Taken', value: data.totalQuizzes || 0 },
          { label: 'Active Today', value: data.activeToday || 0 },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow text-center">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold text-gray-800">{s.value}</p>
          </div>
        ))}
      </div>
    </SidebarLayout>
  );
}

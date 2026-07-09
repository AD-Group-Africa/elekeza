'use client';

import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/admin')
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SidebarLayout><div className="text-white text-center mt-20">Loading...</div></SidebarLayout>;
  if (!data) return <SidebarLayout><div className="text-white text-center mt-20">No data available.</div></SidebarLayout>;

  return (
    <SidebarLayout>
      <h1 className="text-3xl font-bold text-white mb-8">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Learners', value: data.totalLearners },
          { label: 'Teachers', value: data.totalTeachers },
          { label: 'Guardians', value: data.totalGuardians },
          { label: 'Institutions', value: data.totalInstitutions },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow text-center">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-3xl font-bold text-gray-800">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-6 shadow mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Monthly Registrations</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.monthlyRegistrations || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#3B6DE5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Content', value: data.totalContent },
          { label: 'Quizzes', value: data.totalQuizzes },
          { label: 'Active Today', value: data.activeToday },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow text-center">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-3xl font-bold text-gray-800">{s.value}</p>
          </div>
        ))}
      </div>
    </SidebarLayout>
  );
}

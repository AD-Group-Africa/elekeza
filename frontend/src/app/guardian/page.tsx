'use client';

import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';
import DashboardSkeleton from '@/components/DashboardSkeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function GuardianDashboard() {
  const [wards, setWards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/guardian/wards')
      .then(res => setWards(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SidebarLayout><DashboardSkeleton title="Guardian Dashboard" /></SidebarLayout>;

  return (
    <SidebarLayout>
      <h1 className="text-3xl font-bold text-white mb-8">Your Children</h1>
      {wards.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center text-gray-500">No linked children yet.</div>
      ) : (
        wards.map((ward: any) => (
          <div key={ward.id} className="bg-white rounded-xl p-6 shadow mb-6">
            <h2 className="text-xl font-semibold text-blue-900 mb-2">{ward.name}</h2>
            <p className="text-sm text-gray-500 mb-4">SNE Type: {ward.sneType}</p>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center"><p className="text-3xl font-bold text-purple-600">{ward.lessonsCompleted}</p><p className="text-sm text-gray-500">Completed</p></div>
              <div className="text-center"><p className="text-3xl font-bold text-green-600">{ward.averageScore.toFixed(0)}%</p><p className="text-sm text-gray-500">Avg Score</p></div>
              <div className="text-center"><p className="text-3xl font-bold text-blue-600">{ward.lessonsPending}</p><p className="text-sm text-gray-500">Pending</p></div>
            </div>
            <h3 className="text-md font-semibold text-gray-700 mb-2">Progress Over Time</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={ward.progressHistory || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={d => new Date(d).toLocaleDateString()} />
                <YAxis domain={[0, 100]} /><Tooltip />
                <Line type="monotone" dataKey="score" stroke="#3B6DE5" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))
      )}
    </SidebarLayout>
  );
}

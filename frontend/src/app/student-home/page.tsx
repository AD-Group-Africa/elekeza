'use client';
import GamificationWidget from '@/components/GamificationWidget';

import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';
import DashboardSkeleton from '@/components/DashboardSkeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function StudentDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/student')
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SidebarLayout><DashboardSkeleton title="Student Dashboard" /></SidebarLayout>;

  if (!data) return (
    <SidebarLayout>
      <div className="text-white text-center mt-20">
        <h1 className="text-3xl font-bold mb-4">Welcome!</h1>
        <p>No learning data yet. Start your first lesson.</p>
      </div>
    </SidebarLayout>
  );

  return (
    <SidebarLayout>
      <h1 className="text-3xl font-bold text-white mb-8">Your Dashboard</h1>
      {/* Stats */}
      <GamificationWidget />
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Learning Streak', value: `${data.learningStreak} days` },
          { label: 'Completed', value: data.completedLessons },
          { label: 'Pending', value: data.pendingLessons },
          { label: 'Avg Score', value: `${data.averageScore.toFixed(1)}%` },
        ].map((s, i) => (
          <div key={i} className="glass-card rounded-xl p-4 shadow text-center">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold text-gray-800">{s.value}</p>
          </div>
        ))}
      </div>
      {/* Charts */}
      <GamificationWidget />
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="glass-card rounded-xl p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Weekly Minutes</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.weeklyActivity || []}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip />
              <Bar dataKey="minutes" fill="#8B45F5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card rounded-xl p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Competency Progress</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.competencyProgress || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" domain={[0, 100]} /><YAxis type="category" dataKey="area" width={100} /><Tooltip />
              <Bar dataKey="progress" fill="#10B981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Quiz History */}
      <div className="glass-card rounded-xl p-6 shadow">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Quiz History</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data.quizHistory || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={d => new Date(d).toLocaleDateString()} />
            <YAxis domain={[0, 100]} /><Tooltip />
            <Line type="monotone" dataKey="score" stroke="#3B6DE5" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </SidebarLayout>
  );
}



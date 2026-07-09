'use client';
import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Analytics {
  totalLearners: number; activeLearners: number; lessonsCreated: number; lessonsAssigned: number;
  completionRate: number; averageScore: number; atRiskStudents: number;
  weeklyActivity: { day: string; completed: number }[];
  recentAssignments: { studentName: string; lessonId: number; score: number; completed: boolean; date: string }[];
}

const COLORS = ['#3B6DE5', '#8B45F5', '#10B981', '#F59E0B', '#EF4444'];

export default function TeacherDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/analytics/teacher')
      .then(res => setAnalytics(res.data))
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SidebarLayout><div className="flex items-center justify-center h-64 text-white">Loading dashboard...</div></SidebarLayout>;
  if (error) return <SidebarLayout><div className="bg-red-100 text-red-700 p-4 rounded-lg">{error}</div></SidebarLayout>;
  if (!analytics) return null;

  return (
    <SidebarLayout>
      <h1 className="text-3xl font-bold text-white mb-8">Teacher Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Total Learners', value: analytics.totalLearners },
          { label: 'Active This Week', value: analytics.activeLearners },
          { label: 'Avg Score', value: `${analytics.averageScore.toFixed(1)}%` },
          { label: 'Completion Rate', value: `${analytics.completionRate.toFixed(0)}%` },
          { label: 'At Risk', value: analytics.atRiskStudents },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-3xl font-bold text-gray-800">{card.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Weekly Activity</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={analytics.weeklyActivity}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip />
              <Bar dataKey="completed" fill="#3B6DE5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Lesson Completion</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={[
                { name: 'Completed', value: analytics.lessonsAssigned > 0 ? analytics.completionRate : 0 },
                { name: 'Pending', value: analytics.lessonsAssigned > 0 ? 100 - analytics.completionRate : 100 }
              ]} cx="50%" cy="50%" outerRadius={100} dataKey="value" label>
                {[0, 1].map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="bg-white rounded-xl p-6 shadow">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Assignments</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="text-gray-600 border-b"><th>Student</th><th>Lesson</th><th>Score</th><th>Date</th></tr></thead>
            <tbody>
              {analytics.recentAssignments.map((a, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2">{a.studentName}</td>
                  <td className="p-2">Lesson #{a.lessonId}</td>
                  <td className="p-2"><span className={a.score >= 70 ? 'text-green-600' : 'text-red-600'}>{a.score}%</span></td>
                  <td className="p-2 text-sm text-gray-500">{new Date(a.date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SidebarLayout>
  );
}

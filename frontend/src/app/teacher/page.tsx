'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, BookOpen, ClipboardCheck, TrendingUp, MessageSquare, FileText } from 'lucide-react';
import Link from 'next/link';

interface DashboardData {
  totalLearners: number;
  activeLearners: number;
  lessonsCreated: number;
  lessonsAssigned: number;
  completionRate: number;
  averageScore: number;
  atRiskStudents: number;
  weeklyActivity: { day: string; completed: number }[];
  totalQuizzes: number;
}

const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899'];

export default function TeacherDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/analytics/teacher')
      .then(res => setData(res.data))
      .catch(() => setError('Unable to load dashboard. Please try again.'));
  }, []);

  if (error) {
    return (
      <div className="glass-card p-6 text-center text-purple-200">
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 bg-purple-600 text-white px-4 py-2 rounded-lg">Retry</button>
      </div>
    );
  }

  if (!data) {
    return <div className="glass-card p-6 text-purple-200">Loading dashboard…</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-purple-200">Teacher Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard title="Total Learners" value={data.totalLearners} color="#3B82F6" />
        <KpiCard title="Active This Week" value={data.activeLearners} color="#10B981" />
        <KpiCard title="Completion Rate" value={`${data.completionRate}%`} color="#8B5CF6" />
        <KpiCard title="Avg Score" value={`${data.averageScore}%`} color="#F59E0B" />
        <KpiCard title="At Risk" value={data.atRiskStudents} color="#EF4444" />
        <KpiCard title="Quizzes Taken" value={data.totalQuizzes} color="#EC4899" />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card p-4">
          <h3 className="text-lg font-semibold text-purple-200 mb-4">Weekly Activity</h3>
          {data.weeklyActivity?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.weeklyActivity}>
                <XAxis dataKey="day" stroke="#a78bfa" />
                <YAxis stroke="#a78bfa" />
                <Tooltip />
                <Bar dataKey="completed" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-purple-300 py-12">
              <p>No activity this week yet.</p>
              <p className="text-sm">Assign a lesson to get started!</p>
            </div>
          )}
        </div>
        <div className="glass-card p-4">
          <h3 className="text-lg font-semibold text-purple-200 mb-4">Student Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={[
                  { name: 'At Risk', value: data.atRiskStudents },
                  { name: 'Active', value: data.activeLearners },
                  { name: 'Inactive', value: (data.totalLearners - data.activeLearners - data.atRiskStudents) || 0 },
                ]}
                cx="50%" cy="50%" outerRadius={80} label
              >
                {[...Array(3)].map((_, i) => (
                  <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hub Cards – unified teacher workflows */}
      <h2 className="text-xl font-bold text-purple-200 mt-8">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HubCard
          icon={<Users size={24} />}
          title="Student Management"
          stat={`${data.totalLearners} learners`}
          description="View, add, and manage your students."
          href="/teacher/students"
          color="#3B82F6"
        />
        <HubCard
          icon={<BookOpen size={24} />}
          title="Lessons"
          stat={`${data.lessonsCreated} created`}
          description="Upload content, create lessons, and assign them."
          href="/teacher/lessons"
          color="#10B981"
        />
        <HubCard
          icon={<FileText size={24} />}
          title="Exams"
          stat="Create & mark"
          description="Create timed exams, publish them, and view learner results."
          href="/teacher/exams"
          color="#F59E0B"
        />
        <HubCard
          icon={<ClipboardCheck size={24} />}
          title="Assignments"
          stat={`${data.lessonsAssigned} assigned`}
          description="Review submitted work and give feedback."
          href="/teacher/assignments"
          color="#EF4444"
        />
        <HubCard
          icon={<TrendingUp size={24} />}
          title="Progress Tracking"
          stat={`${data.completionRate}% completion`}
          description="See detailed learner and class progress."
          href="/teacher/progress"
          color="#8B5CF6"
        />
        <HubCard
          icon={<MessageSquare size={24} />}
          title="Communication"
          stat="Messages"
          description="Send announcements and message parents."
          href="/teacher/communication"
          color="#EC4899"
        />
      </div>
    </div>
  );
}

function KpiCard({ title, value, color }: { title: string; value: string | number; color: string }) {
  return (
    <div className="glass-card p-4 flex flex-col items-center" style={{ borderTop: `3px solid ${color}` }}>
      <p className="text-purple-300 text-sm">{title}</p>
      <p className="text-2xl font-bold text-purple-100">{value}</p>
    </div>
  );
}

function HubCard({ icon, title, stat, description, href, color }: {
  icon: React.ReactNode;
  title: string;
  stat: string;
  description: string;
  href: string;
  color: string;
}) {
  return (
    <Link href={href}>
      <div className="glass-card p-4 hover:bg-white/5 transition cursor-pointer flex items-start gap-4" style={{ borderLeft: `4px solid ${color}` }}>
        <div className="text-purple-300" style={{ color }}>{icon}</div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-purple-200">{title}</h3>
          <p className="text-purple-300 text-sm">{stat}</p>
          <p className="text-purple-400 text-xs mt-1">{description}</p>
        </div>
      </div>
    </Link>
  );
}

'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BookOpen, ClipboardCheck, FileText, MessageSquare, TrendingUp, Users } from 'lucide-react';
import { Button, Card, LoadingState, PageHeader } from '@/components/ui';
import { learnerCountLabel } from '@/lib/pluralize';
import { teacherApi, teacherKeys } from '../api';

const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899'];

export default function TeacherDashboardScreen() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: teacherKeys.dashboard,
    queryFn: teacherApi.dashboard,
  });

  if (isLoading) return <LoadingState label="Loading dashboard…" />;
  if (isError || !data) {
    return (
      <Card padding="lg" className="text-center text-purple-200">
        <p role="alert">Unable to load dashboard. Please try again.</p>
        <Button className="mt-4" onClick={() => refetch()}>
          Retry
        </Button>
      </Card>
    );
  }

  const inactive = Math.max(0, data.totalLearners - data.activeLearners - data.atRiskStudents);

  return (
    <div className="space-y-6">
      <PageHeader title="Teacher Dashboard" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard title="Total Learners" value={data.totalLearners} color={COLORS[0]} />
        <KpiCard title="Active This Week" value={data.activeLearners} color={COLORS[1]} />
        <KpiCard title="Completion Rate" value={`${data.completionRate}%`} color={COLORS[2]} />
        <KpiCard title="Avg Score" value={`${data.averageScore}%`} color={COLORS[3]} />
        <KpiCard title="At Risk" value={data.atRiskStudents} color={COLORS[4]} />
        <KpiCard title="Quizzes Taken" value={data.totalQuizzes} color={COLORS[5]} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Weekly Activity">
          {data.weeklyActivity?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.weeklyActivity}>
                <XAxis dataKey="day" stroke="#a78bfa" />
                <YAxis stroke="#a78bfa" allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="completed" fill="#7c3aed" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="py-12 text-center text-purple-300">
              <p>No activity this week yet.</p>
              <p className="text-sm">Assign a lesson to get started!</p>
            </div>
          )}
        </Card>
        <Card title="Student Status">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={[
                  { name: 'At Risk', value: data.atRiskStudents },
                  { name: 'Active', value: data.activeLearners },
                  { name: 'Inactive', value: inactive },
                ]}
                dataKey="value"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
                isAnimationActive={false}
              >
                {[COLORS[4], COLORS[1], COLORS[0]].map((c) => (
                  <Cell key={c} fill={c} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <h2 className="mt-8 text-xl font-bold text-purple-200">Quick Actions</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <HubCard
          icon={<Users size={24} />}
          title="Student Management"
          stat={learnerCountLabel(data.totalLearners)}
          description="View, add, and manage your students."
          href="/teacher/students"
          color={COLORS[0]}
        />
        <HubCard
          icon={<BookOpen size={24} />}
          title="Lessons"
          stat={`${data.lessonsCreated} created`}
          description="Upload content, create lessons, and assign them."
          href="/teacher/lessons"
          color={COLORS[1]}
        />
        <HubCard
          icon={<FileText size={24} />}
          title="Exams"
          stat="Create & mark"
          description="Create timed exams, publish them, and view learner results."
          href="/teacher/exams"
          color={COLORS[3]}
        />
        <HubCard
          icon={<ClipboardCheck size={24} />}
          title="Assignments"
          stat={`${data.lessonsAssigned} assigned`}
          description="Assign lessons and follow learner progress."
          href="/teacher/assignments"
          color={COLORS[4]}
        />
        <HubCard
          icon={<TrendingUp size={24} />}
          title="Progress Tracking"
          stat={`${data.completionRate}% completion`}
          description="See detailed learner and class progress."
          href="/teacher/progress"
          color={COLORS[2]}
        />
        <HubCard
          icon={<MessageSquare size={24} />}
          title="Communication"
          stat="Messages"
          description="Read and reply to messages from parents."
          href="/teacher/communication"
          color={COLORS[5]}
        />
      </div>
    </div>
  );
}

function KpiCard({ title, value, color }: { title: string; value: string | number; color: string }) {
  return (
    <div className="glass-card flex flex-col items-center p-4" style={{ borderTop: `3px solid ${color}` }}>
      <p className="text-sm text-purple-300">{title}</p>
      <p className="text-2xl font-bold text-purple-100">{value}</p>
    </div>
  );
}

function HubCard({
  icon,
  title,
  stat,
  description,
  href,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  stat: string;
  description: string;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="glass-card flex items-start gap-4 p-4 transition hover:bg-white/5"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div style={{ color }} aria-hidden="true">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-purple-200">{title}</h3>
        <p className="text-sm text-purple-300">{stat}</p>
        <p className="mt-1 text-xs text-purple-400">{description}</p>
      </div>
    </Link>
  );
}

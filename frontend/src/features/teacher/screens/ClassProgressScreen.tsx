'use client';

import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { User } from 'lucide-react';
import { Alert, Card, EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { teacherApi, teacherKeys } from '../api';
import { ClassCompetencySummary } from '../components/ClassCompetencySummary';

/** Per-learner completed lessons and average score. */
export default function ClassProgressScreen() {
  const {
    data: students = [],
    isLoading,
    isError,
  } = useQuery({ queryKey: teacherKeys.classProgress, queryFn: teacherApi.classProgress });

  if (isLoading) return <LoadingState label="Loading progress…" />;

  return (
    <div className="space-y-6">
      <PageHeader title="Progress Tracking" />
      {isError && <Alert tone="error">Could not load learner progress. Please refresh to try again.</Alert>}

      <ClassCompetencySummary />

      {students.length === 0 ? (
        <EmptyState icon={<User size={48} />} title="No learner data yet." />
      ) : (
        <>
          <Card title="Learner Performance">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={students.map((s) => ({ name: s.studentName, score: s.averageScore }))}>
                <XAxis dataKey="name" stroke="#a78bfa" />
                <YAxis stroke="#a78bfa" domain={[0, 100]} />
                <Tooltip />
                <Bar
                  dataKey="score"
                  name="Average score"
                  fill="#7c3aed"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Student Details">
            <ul className="space-y-3">
              {students.map((s) => (
                <li key={s.studentId} className="flex items-center justify-between rounded-lg bg-white/5 p-3">
                  <div className="flex items-center gap-2">
                    <User size={18} className="text-purple-300" aria-hidden="true" />
                    <span className="text-purple-200">{s.studentName}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-purple-300">{s.completedLessons} lessons</p>
                    <p className="text-xs text-purple-400">{s.averageScore}% avg</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, GraduationCap, Users } from 'lucide-react';
import { ButtonLink, Card, PageHeader } from '@/components/ui';
import { adminApi, adminKeys, type SchoolLearner } from '../api';

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="flex flex-col items-center">
      <span aria-hidden="true" className="mb-2">
        {icon}
      </span>
      <p className="text-sm text-purple-300">{label}</p>
      <p className="text-2xl font-bold text-purple-100">{value}</p>
    </Card>
  );
}

export default function SchoolAdminDashboardScreen() {
  const stats = useQuery({ queryKey: adminKeys.schoolStats, queryFn: adminApi.schoolStats });
  const learners = useQuery({ queryKey: adminKeys.learners, queryFn: adminApi.learners });

  const byGrade = useMemo(() => {
    const groups: Record<string, SchoolLearner[]> = {};
    (learners.data ?? []).forEach((s) => {
      (groups[s.grade || 'Unassigned'] ??= []).push(s);
    });
    return groups;
  }, [learners.data]);

  return (
    <div className="space-y-6">
      <PageHeader title="School Administration" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Kpi
          icon={<Users size={24} className="text-blue-400" />}
          label="Teachers"
          value={stats.data?.totalTeachers || 0}
        />
        <Kpi
          icon={<GraduationCap size={24} className="text-green-400" />}
          label="Students"
          value={stats.data?.totalLearners || 0}
        />
        <Kpi
          icon={<BookOpen size={24} className="text-purple-400" />}
          label="Lessons"
          value={stats.data?.totalContent || 0}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Students by Grade">
          {Object.keys(byGrade).length === 0 ? (
            <p className="text-purple-300">No students enrolled.</p>
          ) : (
            Object.entries(byGrade).map(([grade, students]) => (
              <div key={grade} className="mb-2">
                <h3 className="font-medium text-purple-200">
                  {grade} ({students.length})
                </h3>
                <ul className="ml-4 text-sm text-purple-300">
                  {students.slice(0, 5).map((s) => (
                    <li key={s.id}>{s.name}</li>
                  ))}
                  {students.length > 5 && <li>…and {students.length - 5} more</li>}
                </ul>
              </div>
            ))
          )}
        </Card>
        <Card title="Quick Actions">
          <div className="grid grid-cols-2 gap-2">
            <ButtonLink href="/teacher/students" variant="secondary">
              Add Student
            </ButtonLink>
            <ButtonLink href="/school/import" variant="secondary">
              Import CSV
            </ButtonLink>
            <ButtonLink href="/analytics" variant="secondary">
              Engagement
            </ButtonLink>
            <ButtonLink href="/admin/staff" variant="secondary">
              Staff accounts
            </ButtonLink>
          </div>
        </Card>
      </div>
    </div>
  );
}

'use client';

/** School learner directory: find a learner and open their full record. */

import { useMemo, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { ButtonLink, Card, EmptyState, LoadingState, PageHeader, Select, TextInput } from '@/components/ui';
import { useStudents } from '@/features/teacher/api';
import { cn } from '@/lib/cn';
import { LearnerRecord } from '../components/LearnerRecord';

export default function LearnersScreen() {
  const students = useStudents();
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('');
  const [selected, setSelected] = useState<number | null>(null);

  const grades = useMemo(
    () => [...new Set((students.data ?? []).map((s) => s.grade).filter(Boolean) as string[])].sort(),
    [students.data],
  );
  const filtered = (students.data ?? []).filter(
    (s) =>
      (!grade || s.grade === grade) &&
      (s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())),
  );
  const current = students.data?.find((s) => s.id === selected) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learners"
        description="Every learner in your school: progress, attendance, competencies and guardians."
        actions={
          <>
            <ButtonLink href="/school/import" variant="secondary">
              Import from CSV
            </ButtonLink>
            <ButtonLink href="/teacher/students">Add a learner</ButtonLink>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Card padding="sm">
          <div className="space-y-2 p-1">
            <TextInput
              type="search"
              aria-label="Search learners"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {grades.length > 0 && (
              <Select aria-label="Filter by grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="">All grades</option>
                {grades.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            )}
          </div>
          {students.isLoading ? (
            <LoadingState />
          ) : filtered.length === 0 ? (
            <p className="p-2 text-sm text-purple-300">No learners found.</p>
          ) : (
            <ul className="mt-2 max-h-[60vh] space-y-1 overflow-y-auto">
              {filtered.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(s.id)}
                    aria-current={s.id === selected ? 'true' : undefined}
                    className={cn(
                      'w-full rounded-lg px-3 py-2 text-left text-sm transition',
                      s.id === selected ? 'bg-purple-600/40 text-white' : 'text-purple-200 hover:bg-white/10',
                    )}
                  >
                    <span className="block font-medium">{s.name}</span>
                    <span className="block text-xs text-fg-muted">
                      {[s.grade, s.email].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {current ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-purple-100">{current.name}</h2>
            <LearnerRecord key={current.id} learnerId={current.id} />
          </div>
        ) : (
          <EmptyState icon={<GraduationCap size={48} />} title="Choose a learner to see their record." />
        )}
      </div>
    </div>
  );
}

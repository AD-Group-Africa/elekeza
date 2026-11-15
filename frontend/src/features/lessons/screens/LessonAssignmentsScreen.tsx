'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Plus } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  LoadingState,
  PageHeader,
  Select,
  Toast,
} from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useStudents } from '@/features/teacher/api';
import { lessonKeys, lessonsApi, useLessonList } from '../api';

const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};
const STATUS_TONE = { ASSIGNED: 'neutral', IN_PROGRESS: 'info', COMPLETED: 'success' } as const;

/** Assign lessons to learners and follow each assignment's status and score. */
export default function LessonAssignmentsScreen() {
  const queryClient = useQueryClient();
  const assignments = useQuery({ queryKey: lessonKeys.assignments, queryFn: lessonsApi.assignments });
  const lessons = useLessonList();
  const students = useStudents();
  const [showForm, setShowForm] = useState(false);
  const [contentId, setContentId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [toast, setToast] = useState('');

  const assign = useMutation({
    mutationFn: () => lessonsApi.assign(Number(contentId), [Number(studentId)]),
    onSuccess: async () => {
      setShowForm(false);
      setContentId('');
      setStudentId('');
      setToast('Assignment created!');
      await queryClient.invalidateQueries({ queryKey: lessonKeys.assignments });
    },
  });

  const list = assignments.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignments"
        actions={
          <Button icon={<Plus size={18} aria-hidden="true" />} onClick={() => setShowForm((s) => !s)}>
            New Assignment
          </Button>
        }
      />

      {showForm && (
        <Card padding="lg" title="Assign Lesson to Student">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              assign.mutate();
            }}
            className="space-y-4"
          >
            <Field id="assign-lesson" label="Lesson">
              <Select id="assign-lesson" value={contentId} onChange={(e) => setContentId(e.target.value)} required>
                <option value="">Choose a lesson…</option>
                {(lessons.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="assign-student" label="Student">
              <Select id="assign-student" value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
                <option value="">Choose a student…</option>
                {(students.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" loading={assign.isPending}>
              Assign
            </Button>
            {assign.isError && <Alert tone="error">Failed to create assignment.</Alert>}
          </form>
        </Card>
      )}

      {assignments.isError && <Alert tone="error">Could not load assignments. Please refresh to try again.</Alert>}

      {assignments.isLoading ? (
        <LoadingState label="Loading assignments…" />
      ) : list.length === 0 ? (
        <EmptyState icon={<ClipboardCheck size={48} />} title="No assignments yet." />
      ) : (
        <Card>
          <ul className="space-y-3">
            {list.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/5 p-4">
                <div>
                  <h2 className="font-semibold text-purple-200">{a.lessonTitle}</h2>
                  <p className="text-sm text-purple-300">
                    {a.studentName}
                    {a.assignedAt ? ` · assigned ${formatDate(a.assignedAt)}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <Badge tone={STATUS_TONE[a.status as keyof typeof STATUS_TONE] ?? 'neutral'}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </Badge>
                  {a.score != null && <p className="mt-1 text-sm text-purple-300">Score {Math.round(a.score)}%</p>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}

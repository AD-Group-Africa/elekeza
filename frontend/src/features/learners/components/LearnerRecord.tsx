'use client';

/**
 * One learner's school record for staff: headline progress, attendance,
 * curriculum competencies, guardians (with link management for admins) and
 * a form to link an existing guardian account.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Field, LoadingState, Select, TextInput } from '@/components/ui';
import { useAuth } from '@/features/auth';
import GuardianLinksPanel from '@/features/admin/components/GuardianLinksPanel';
import { adminKeys } from '@/features/admin/api';
import { attendanceApi } from '@/features/attendance/api';
import { curriculumApi, curriculumKeys } from '@/features/curriculum/api';
import { CompetencyList } from '@/features/curriculum/components/CompetencyList';
import { teacherApi, teacherKeys } from '@/features/teacher/api';
import { getErrorMessage } from '@/lib/api';
import { isSchoolAdmin } from '@/lib/roles';
import { formatDate } from '@/lib/format';

const RELATIONSHIPS = [
  ['PARENT', 'Parent'],
  ['LEGAL_GUARDIAN', 'Legal guardian'],
  ['CAREGIVER', 'Caregiver'],
  ['OLDER_SIBLING', 'Older sibling'],
  ['OTHER', 'Other'],
] as const;

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white/5 p-3 text-center">
      <dt className="text-xs text-purple-300">{label}</dt>
      <dd className="text-xl font-bold text-purple-100">{value}</dd>
    </div>
  );
}

export function LearnerRecord({ learnerId }: { learnerId: number }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const progress = useQuery({
    queryKey: teacherKeys.progress(learnerId),
    queryFn: () => teacherApi.studentProgress(learnerId),
  });
  const attendance = useQuery({
    queryKey: ['attendance', 'learner', learnerId],
    queryFn: () => attendanceApi.learnerHistory(learnerId),
  });
  const competencies = useQuery({
    queryKey: curriculumKeys.learner(learnerId),
    queryFn: () => curriculumApi.learnerProgress(learnerId),
  });

  const [guardianEmail, setGuardianEmail] = useState('');
  const [relationship, setRelationship] = useState('PARENT');
  const [linkMessage, setLinkMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const link = useMutation({
    mutationFn: () => teacherApi.linkGuardian(learnerId, guardianEmail.trim(), relationship),
    onSuccess: async () => {
      setLinkMessage({ tone: 'success', text: `${guardianEmail.trim()} can now follow this learner.` });
      setGuardianEmail('');
      if (user?.institutionId) {
        await queryClient.invalidateQueries({ queryKey: adminKeys.guardianLinks(user.institutionId, learnerId) });
      }
    },
    onError: (err) =>
      setLinkMessage({
        tone: 'error',
        text: getErrorMessage(
          err,
          'Could not link that guardian. They need an existing guardian account (e.g. from CSV import).',
        ),
      }),
  });

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Lessons completed" value={progress.data?.completedLessons ?? '—'} />
        <Stat label="Average score" value={progress.data ? `${Math.round(progress.data.averageScore)}%` : '—'} />
        <Stat label="Attendance rate" value={attendance.data ? `${attendance.data.attendanceRate}%` : '—'} />
        <Stat label="Days marked" value={attendance.data?.sessionsMarked ?? '—'} />
      </dl>

      <Card title="Curriculum competencies">
        {competencies.isLoading ? (
          <LoadingState />
        ) : (
          <CompetencyList
            rows={competencies.data?.competencies ?? []}
            unit="lessons"
            empty={
              competencies.data?.note ?? 'No evidence yet. Map lessons to the curriculum to see competencies here.'
            }
          />
        )}
      </Card>

      {attendance.data && attendance.data.records.length > 0 && (
        <Card title="Recent attendance">
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {attendance.data.records.slice(0, 10).map((r, i) => (
              <li key={i} className="flex justify-between rounded bg-white/5 px-3 py-1.5 text-purple-200">
                <span>
                  {formatDate(r.date)} · {r.className}
                </span>
                <span className="font-medium">{r.status}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isSchoolAdmin(user?.role) && <GuardianLinksPanel learnerId={learnerId} />}

      <Card title="Link a guardian">
        <form
          className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setLinkMessage(null);
            link.mutate();
          }}
        >
          <Field id={`guardian-email-${learnerId}`} label="Guardian's account email">
            <TextInput
              id={`guardian-email-${learnerId}`}
              type="email"
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              placeholder="parent@example.com"
              required
            />
          </Field>
          <Field id={`guardian-rel-${learnerId}`} label="Relationship">
            <Select
              id={`guardian-rel-${learnerId}`}
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
            >
              {RELATIONSHIPS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" loading={link.isPending}>
            Link
          </Button>
        </form>
        {linkMessage && (
          <Alert tone={linkMessage.tone} className="mt-3">
            {linkMessage.text}
          </Alert>
        )}
      </Card>
    </div>
  );
}

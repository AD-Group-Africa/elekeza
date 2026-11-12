'use client';

/**
 * Classes — create classes (school admins) and manage who is enrolled
 * (any staff). Enrolment drives attendance registers, timetables, classwork
 * and class fee structures.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, School, UserMinus, Users } from 'lucide-react';
import { Alert, Button, Card, EmptyState, Field, LoadingState, PageHeader, TextInput } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { useClasses } from '@/features/attendance/api';
import { useStudents } from '@/features/teacher/api';
import { getErrorMessage } from '@/lib/api';
import { learnerCountLabel } from '@/lib/pluralize';
import { isSchoolAdmin } from '@/lib/roles';
import { cn } from '@/lib/cn';
import { classKeys, classesApi } from '../api';

type Message = { tone: 'success' | 'error'; text: string } | null;

export default function ClassesScreen() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canCreate = isSchoolAdmin(user?.role);
  const classes = useClasses();
  const students = useStudents();
  const [chosen, setChosen] = useState<number | null>(null);
  const classId = chosen ?? classes.data?.[0]?.id ?? null;
  const selected = classes.data?.find((c) => c.id === classId) ?? null;
  const [message, setMessage] = useState<Message>(null);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [toAdd, setToAdd] = useState<number[]>([]);
  const [search, setSearch] = useState('');

  const learners = useQuery({
    queryKey: classKeys.learners(classId ?? 0),
    queryFn: () => classesApi.learners(classId!),
    enabled: classId != null,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: classKeys.list });
    if (classId != null) await queryClient.invalidateQueries({ queryKey: classKeys.learners(classId) });
  };
  const onError = (fallback: string) => (err: unknown) =>
    setMessage({ tone: 'error', text: getErrorMessage(err, fallback) });

  const create = useMutation({
    mutationFn: () => classesApi.create(name.trim(), grade.trim() || undefined),
    onSuccess: async (cls) => {
      setMessage({ tone: 'success', text: `Class "${cls.name}" created. Now add learners to it.` });
      setName('');
      setGrade('');
      setChosen(cls.id);
      await refresh();
    },
    onError: onError('Could not create the class.'),
  });

  const enroll = useMutation({
    mutationFn: () => classesApi.enroll(classId!, toAdd),
    onSuccess: async () => {
      setMessage({ tone: 'success', text: `${learnerCountLabel(toAdd.length)} added to ${selected?.name}.` });
      setToAdd([]);
      await refresh();
    },
    onError: onError('Could not add the learners.'),
  });

  const remove = useMutation({
    mutationFn: (learnerId: number) => classesApi.unenroll(classId!, learnerId),
    onSuccess: async () => {
      setMessage({ tone: 'success', text: 'Learner removed from the class.' });
      await refresh();
    },
    onError: onError('Could not remove the learner.'),
  });

  const enrolledIds = useMemo(() => new Set((learners.data ?? []).map((l) => l.learnerId)), [learners.data]);
  const candidates = (students.data ?? [])
    .filter((s) => !enrolledIds.has(s.id))
    .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const toggleCandidate = (id: number) =>
    setToAdd((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes"
        description="Group learners into classes. Attendance, timetables, classwork and class fees all use these."
      />
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <div className="grid items-start gap-6 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-4">
          {canCreate && (
            <Card title="New class">
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setMessage(null);
                  create.mutate();
                }}
              >
                <Field id="class-name" label="Class name">
                  <TextInput
                    id="class-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Grade 4 Blue"
                    required
                    maxLength={100}
                  />
                </Field>
                <Field id="class-grade" label="Grade (optional)">
                  <TextInput
                    id="class-grade"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="e.g. Grade 4"
                  />
                </Field>
                <Button
                  type="submit"
                  icon={<Plus size={16} aria-hidden="true" />}
                  loading={create.isPending}
                  className="w-full"
                >
                  Create class
                </Button>
              </form>
            </Card>
          )}

          <Card title="Your classes" padding="sm">
            {classes.isLoading ? (
              <LoadingState />
            ) : (classes.data ?? []).length === 0 ? (
              <p className="p-2 text-sm text-purple-300">
                {canCreate
                  ? 'No classes yet — create the first one above.'
                  : 'No classes yet. Ask your school administrator to create them.'}
              </p>
            ) : (
              <ul className="space-y-1">
                {classes.data!.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setChosen(c.id);
                        setToAdd([]);
                        setMessage(null);
                      }}
                      aria-current={c.id === classId ? 'true' : undefined}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition',
                        c.id === classId ? 'bg-purple-600/40 text-white' : 'text-purple-200 hover:bg-white/10',
                      )}
                    >
                      <span>
                        <span className="block font-medium">{c.name}</span>
                        {c.gradeLevel && <span className="block text-xs text-fg-muted">{c.gradeLevel}</span>}
                      </span>
                      <span className="text-xs text-fg-muted">{learnerCountLabel(c.learnerCount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {selected ? (
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <Card
              title={
                <span className="flex items-center gap-2">
                  <Users size={18} aria-hidden="true" /> {selected.name}
                </span>
              }
            >
              {learners.isLoading ? (
                <LoadingState />
              ) : (learners.data ?? []).length === 0 ? (
                <p className="text-sm text-purple-300">Nobody is enrolled yet. Add learners from the list.</p>
              ) : (
                <ul className="divide-y divide-white/10">
                  {learners.data!.map((l) => (
                    <li key={l.learnerId} className="flex items-center justify-between gap-3 py-2">
                      <span>
                        <span className="block text-purple-100">{l.name}</span>
                        <span className="block text-xs text-purple-400">{l.email}</span>
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<UserMinus size={14} aria-hidden="true" />}
                        onClick={() => remove.mutate(l.learnerId)}
                        disabled={remove.isPending}
                        aria-label={`Remove ${l.name} from ${selected.name}`}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Add learners">
              <TextInput
                type="search"
                aria-label="Search learners"
                placeholder="Search learners…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-3"
              />
              {students.isLoading ? (
                <LoadingState />
              ) : candidates.length === 0 ? (
                <p className="text-sm text-purple-300">
                  Everyone matching is already enrolled. New learners come from Import Learners or Students.
                </p>
              ) : (
                <fieldset>
                  <legend className="sr-only">Learners to add to {selected.name}</legend>
                  <ul className="max-h-80 space-y-1 overflow-y-auto">
                    {candidates.map((s) => (
                      <li key={s.id}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-purple-200 hover:bg-white/10">
                          <input
                            type="checkbox"
                            checked={toAdd.includes(s.id)}
                            onChange={() => toggleCandidate(s.id)}
                            className="h-4 w-4"
                          />
                          <span>{s.name}</span>
                          {s.grade && <span className="text-xs text-purple-400">{s.grade}</span>}
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              )}
              {candidates.length > 0 && (
                <Button
                  className="mt-3 w-full"
                  onClick={() => {
                    setMessage(null);
                    enroll.mutate();
                  }}
                  disabled={toAdd.length === 0}
                  loading={enroll.isPending}
                >
                  Add {toAdd.length > 0 ? learnerCountLabel(toAdd.length) : 'learners'}
                </Button>
              )}
            </Card>
          </div>
        ) : (
          !classes.isLoading && (
            <EmptyState icon={<School size={48} />} title="Select or create a class to manage its learners." />
          )
        )}
      </div>
    </div>
  );
}

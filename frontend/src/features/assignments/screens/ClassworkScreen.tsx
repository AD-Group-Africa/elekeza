'use client';

/**
 * Classwork — teacher/school-admin view of class assignments.
 *
 * Create assignments for a class, see submission progress per assignment,
 * open submissions and grade them with feedback. Authorization is enforced
 * server-side; this UI only mirrors the same boundaries for early feedback.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Field, LoadingState, PageHeader, Select, TextInput, Textarea } from '@/components/ui';
import { getErrorStatus } from '@/lib/api';
import { learnerCountLabel } from '@/lib/pluralize';
import { useClasses } from '@/features/attendance/api';
import { assignmentKeys, assignmentsApi, type AssignmentInfo, type SubmissionInfo } from '../api';

type Message = { tone: 'success' | 'error'; text: string } | null;

export default function ClassworkScreen() {
  const queryClient = useQueryClient();
  const classesQuery = useClasses();
  const classes = classesQuery.data ?? [];
  const [chosenClassId, setChosenClassId] = useState<number | null>(null);
  const classId = chosenClassId ?? classes[0]?.id ?? null;
  const [message, setMessage] = useState<Message>(null);

  // create form
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [points, setPoints] = useState('100');

  // grading panel
  const [openAssignmentId, setOpenAssignmentId] = useState<number | null>(null);
  const [scores, setScores] = useState<Record<number, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<number, string>>({});

  const assignmentsQuery = useQuery({
    queryKey: assignmentKeys.forClass(classId ?? 0),
    queryFn: () => assignmentsApi.classAssignments(classId!),
    enabled: classId != null,
  });
  const submissionsQuery = useQuery({
    queryKey: assignmentKeys.submissions(openAssignmentId ?? 0),
    queryFn: () => assignmentsApi.submissions(openAssignmentId!),
    enabled: openAssignmentId != null,
  });

  const create = useMutation({
    mutationFn: () =>
      assignmentsApi.create({
        classId: classId!,
        title,
        instructions: instructions || undefined,
        dueDate: dueDate || undefined,
        points: Number(points) || 100,
      }),
    onSuccess: async () => {
      setTitle('');
      setInstructions('');
      setDueDate('');
      setPoints('100');
      setMessage({ tone: 'success', text: 'Assignment created and published to the class.' });
      await queryClient.invalidateQueries({ queryKey: assignmentKeys.forClass(classId!) });
    },
    onError: (err) =>
      setMessage({
        tone: 'error',
        text:
          getErrorStatus(err) === 403
            ? 'Not authorized for this class.'
            : 'Could not create the assignment. Please try again.',
      }),
  });

  const grade = useMutation({
    mutationFn: ({ s, score }: { a: AssignmentInfo; s: SubmissionInfo; score: number }) =>
      assignmentsApi.grade(s.id, score, feedbacks[s.id] || undefined),
    onSuccess: async (saved, { a, s, score }) => {
      queryClient.setQueryData<SubmissionInfo[]>(assignmentKeys.submissions(a.id), (rows = []) =>
        rows.map((r) => (r.id === s.id ? saved : r)),
      );
      setMessage({ tone: 'success', text: `Graded ${s.learnerName ?? 'learner'}: ${score}/${a.points}.` });
      await queryClient.invalidateQueries({ queryKey: assignmentKeys.forClass(a.classId) });
    },
    onError: (err) =>
      setMessage({
        tone: 'error',
        text: getErrorStatus(err) === 400 ? 'Score out of range.' : 'Could not save the grade. Please try again.',
      }),
  });

  const onCreate = () => {
    if (classId == null) return;
    if (!title.trim()) {
      setMessage({ tone: 'error', text: 'Give the assignment a title.' });
      return;
    }
    setMessage(null);
    create.mutate();
  };

  const onGrade = (a: AssignmentInfo, s: SubmissionInfo) => {
    const raw = scores[s.id];
    const score = Number(raw);
    if (raw === undefined || raw === '' || Number.isNaN(score) || score < 0 || score > a.points) {
      setMessage({ tone: 'error', text: `Score must be between 0 and ${a.points}.` });
      return;
    }
    setMessage(null);
    grade.mutate({ a, s, score });
  };

  const assignments = assignmentsQuery.data ?? [];
  const submissions = submissionsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Assignments" description="Create work for your classes and grade what learners submit." />

      {classesQuery.isError && (
        <Alert tone="error" className="mb-4">
          Could not load classes. Please refresh to try again.
        </Alert>
      )}
      {assignmentsQuery.isError && (
        <Alert tone="error" className="mb-4">
          Could not load assignments for this class.
        </Alert>
      )}
      {message && (
        <Alert tone={message.tone} className="mb-4">
          {message.text}
        </Alert>
      )}

      <Card padding="lg" title="New assignment" className="mb-8" role="region" aria-label="Create assignment">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="cw-title" label="Title" className="sm:col-span-2">
            <TextInput
              id="cw-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="e.g. Fractions practice set 2"
            />
          </Field>
          <Field id="cw-instructions" label="Instructions" className="sm:col-span-2">
            <Textarea
              id="cw-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              maxLength={10000}
              placeholder="What should learners do? Keep it clear and short."
            />
          </Field>
          <Field id="cw-due" label="Due date">
            <TextInput id="cw-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field id="cw-points" label="Points">
            <TextInput
              id="cw-points"
              type="number"
              min={1}
              max={1000}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
          </Field>
          <Field id="cw-class" label="Class" className="sm:col-span-2">
            <Select
              id="cw-class"
              value={classId ?? ''}
              onChange={(e) => {
                setOpenAssignmentId(null);
                setChosenClassId(Number(e.target.value));
              }}
            >
              {classes.length === 0 && <option value="">No classes yet</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({learnerCountLabel(c.learnerCount)})
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button
          variant="success"
          className="mt-4"
          onClick={onCreate}
          loading={create.isPending}
          disabled={classId == null}
        >
          {create.isPending ? 'Creating…' : 'Create assignment'}
        </Button>
      </Card>

      {classesQuery.isLoading || assignmentsQuery.isLoading ? (
        <LoadingState />
      ) : assignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong p-8 text-center text-fg-muted">
          No assignments for this class yet — create the first one above.
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Class assignments">
          {assignments.map((a) => (
            <li key={a.id}>
              <Card>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-fg">{a.title}</h3>
                    <p className="text-sm text-fg-muted">
                      {a.dueDate ? `Due ${a.dueDate}` : 'No due date'} · {a.points} points · {a.gradedCount}/
                      {a.submissionCount || 0} graded
                      {a.submissionCount > 0 ? ` (${a.submissionCount} submitted)` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenAssignmentId((cur) => (cur === a.id ? null : a.id))}
                    aria-expanded={openAssignmentId === a.id}
                    className="shrink-0 text-sm font-medium text-accent-strong underline underline-offset-2 hover:no-underline"
                  >
                    {openAssignmentId === a.id ? 'Close submissions' : 'View submissions'}
                  </button>
                </div>

                {openAssignmentId === a.id && (
                  <div className="mt-3">
                    {submissionsQuery.isLoading ? (
                      <LoadingState label="Loading submissions…" className="py-2 text-sm" />
                    ) : submissionsQuery.isError ? (
                      <p className="text-sm text-danger">Could not load submissions.</p>
                    ) : submissions.length === 0 ? (
                      <p className="text-sm text-fg-subtle">No submissions yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {submissions.map((s) => (
                          <li key={s.id} className="rounded-lg border border-line p-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <span className="text-sm font-medium text-fg">
                                {s.learnerName ?? `Learner ${s.learnerId}`}
                              </span>
                              {s.graded ? (
                                <span className="text-xs font-semibold text-ok">
                                  {s.score}/{a.points} · {s.feedback ?? 'no feedback'}
                                </span>
                              ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                  <label className="sr-only" htmlFor={`score-${s.id}`}>
                                    Score for {s.learnerName}
                                  </label>
                                  <TextInput
                                    id={`score-${s.id}`}
                                    type="number"
                                    min={0}
                                    max={a.points}
                                    value={scores[s.id] ?? ''}
                                    onChange={(e) => setScores((m) => ({ ...m, [s.id]: e.target.value }))}
                                    placeholder={`0–${a.points}`}
                                    className="w-24 py-1.5 text-sm"
                                  />
                                  <label className="sr-only" htmlFor={`fb-${s.id}`}>
                                    Feedback for {s.learnerName}
                                  </label>
                                  <TextInput
                                    id={`fb-${s.id}`}
                                    value={feedbacks[s.id] ?? ''}
                                    onChange={(e) => setFeedbacks((m) => ({ ...m, [s.id]: e.target.value }))}
                                    maxLength={2000}
                                    placeholder="Feedback (optional)"
                                    className="w-full py-1.5 text-sm sm:w-56"
                                  />
                                  <Button
                                    size="sm"
                                    variant="success"
                                    onClick={() => onGrade(a, s)}
                                    loading={grade.isPending && grade.variables?.s.id === s.id}
                                  >
                                    Save grade
                                  </Button>
                                </div>
                              )}
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-fg-muted">{s.content}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

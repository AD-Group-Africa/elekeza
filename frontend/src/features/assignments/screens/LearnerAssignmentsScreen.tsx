'use client';

/**
 * Assignments — learner view.
 *
 * Shows the learner's published assignments, lets them submit (and
 * resubmit — the server updates the existing submission), and displays
 * graded feedback. Learner-facing language: plain, encouraging, no jargon.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, Field, LoadingState, PageHeader, Textarea } from '@/components/ui';
import { getErrorStatus } from '@/lib/api';
import { assignmentKeys, assignmentsApi, type AssignmentInfo, type SubmissionInfo } from '../api';

function dueLabel(due: string | null): string {
  if (!due) return 'No due date';
  const dueDate = new Date(due + 'T23:59:59');
  const days = Math.ceil((dueDate.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `Was due ${due}`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

type Message = { tone: 'success' | 'error'; text: string } | null;

export default function LearnerAssignmentsScreen() {
  const queryClient = useQueryClient();
  const assignments = useQuery({ queryKey: assignmentKeys.mine, queryFn: assignmentsApi.mine });
  const submissions = useQuery({ queryKey: assignmentKeys.mySubmissions, queryFn: assignmentsApi.mySubmissions });
  const [openId, setOpenId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState<Message>(null);

  const submissionFor = (id: number): SubmissionInfo | null =>
    submissions.data?.find((s) => s.assignmentId === id) ?? null;

  const submit = useMutation({
    mutationFn: (a: AssignmentInfo) => assignmentsApi.submit(a.id, draft),
    onSuccess: (saved) => {
      queryClient.setQueryData<SubmissionInfo[]>(assignmentKeys.mySubmissions, (rows = []) => [
        saved,
        ...rows.filter((s) => s.assignmentId !== saved.assignmentId),
      ]);
      setMessage({ tone: 'success', text: 'Submitted! Your teacher can now see your work.' });
    },
    onError: (err) => {
      const status = getErrorStatus(err);
      setMessage({
        tone: 'error',
        text:
          status === 403
            ? 'You are not enrolled in this class.'
            : status === 400
              ? 'This assignment is not open for submissions.'
              : 'Could not submit. Please try again.',
      });
    },
  });

  const toggle = (a: AssignmentInfo) => {
    setMessage(null);
    if (openId === a.id) {
      setOpenId(null);
      return;
    }
    setOpenId(a.id);
    setDraft(submissionFor(a.id)?.content ?? '');
  };

  const onSubmit = (a: AssignmentInfo) => {
    if (!draft.trim()) {
      setMessage({ tone: 'error', text: 'Write your answer first.' });
      return;
    }
    setMessage(null);
    submit.mutate(a);
  };

  const loading = assignments.isLoading || submissions.isLoading;
  const list = assignments.data ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="My assignments"
        description="Work set by your teachers. Take your time — you can always improve your answer."
      />

      {(assignments.isError || submissions.isError) && (
        <Alert tone="error" className="mb-4">
          Could not load your assignments. Please refresh to try again.
        </Alert>
      )}
      {message && (
        <Alert tone={message.tone} className="mb-4">
          {message.text}
        </Alert>
      )}

      {loading ? (
        <LoadingState />
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong p-8 text-center text-fg-muted">
          No assignments right now. Enjoy the breather — new work will appear here.
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Assignments">
          {list.map((a) => {
            const sub = submissionFor(a.id);
            const open = openId === a.id;
            return (
              <li key={a.id}>
                <Card>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="font-semibold text-fg">{a.title}</h2>
                      <p className="text-sm text-fg-muted">
                        {a.className ?? 'Class'} · {dueLabel(a.dueDate)} · {a.points} points
                      </p>
                    </div>
                    {sub?.graded ? (
                      <Badge tone="success">
                        Graded: {sub.score}/{a.points}
                      </Badge>
                    ) : sub ? (
                      <Badge tone="info">Submitted</Badge>
                    ) : (
                      <Badge tone="warning">To do</Badge>
                    )}
                  </div>

                  {a.instructions && <p className="mt-2 text-sm text-fg">{a.instructions}</p>}
                  {sub?.feedback && (
                    <p className="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                      Teacher feedback: {sub.feedback}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => toggle(a)}
                    aria-expanded={open}
                    className="mt-3 text-sm font-medium text-accent-strong underline underline-offset-2 hover:no-underline"
                  >
                    {open ? 'Close' : sub ? 'Improve my answer' : 'Open and answer'}
                  </button>

                  {open && (
                    <div className="mt-3 space-y-2">
                      <Field id={`answer-${a.id}`} label="Your answer">
                        <Textarea
                          id={`answer-${a.id}`}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          rows={5}
                          maxLength={20000}
                          placeholder="Write your answer here…"
                        />
                      </Field>
                      <Button variant="success" onClick={() => onSubmit(a)} loading={submit.isPending}>
                        {submit.isPending ? 'Submitting…' : sub ? 'Update my answer' : 'Submit'}
                      </Button>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

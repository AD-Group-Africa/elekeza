'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Lock, Plus, Send } from 'lucide-react';
import { Alert, Badge, Button, Card, EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { examApi, examKeys, type AttemptDetail, type ExamSummary } from '../api';
import { ExamForm } from '../components/ExamForm';
import { MarkingPanel } from '../components/MarkingPanel';

const STATUS_TONE = { PUBLISHED: 'success', CLOSED: 'neutral', DRAFT: 'warning' } as const;

/** Staff exam management: create, publish/close, view results, mark short answers. */
export default function TeacherExamsScreen() {
  const queryClient = useQueryClient();
  const exams = useQuery({ queryKey: examKeys.staffList, queryFn: examApi.list });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ExamSummary | null>(null);
  const [marking, setMarking] = useState<AttemptDetail | null>(null);

  const results = useQuery({
    queryKey: examKeys.results(selected?.id ?? 0),
    queryFn: () => examApi.results(selected!.id),
    enabled: selected != null,
  });

  const refreshList = () => queryClient.invalidateQueries({ queryKey: examKeys.staffList });

  const create = useMutation({
    mutationFn: examApi.create,
    onSuccess: async () => {
      setShowForm(false);
      await refreshList();
    },
    onError: (e) => setError(getErrorMessage(e, 'Could not create the exam.')),
  });

  const changeStatus = useMutation({
    mutationFn: ({ exam, action }: { exam: ExamSummary; action: 'publish' | 'close' }) =>
      action === 'publish' ? examApi.publish(exam.id) : examApi.close(exam.id),
    onSuccess: refreshList,
    onError: (e) => setError(getErrorMessage(e, 'Action failed.')),
  });

  const mark = useMutation({
    mutationFn: ({ questionId, marks, feedback }: { questionId: number; marks: number; feedback?: string }) =>
      examApi.mark(marking!.attemptId, questionId, marks, feedback),
    onSuccess: async (updated) => {
      setMarking(updated);
      if (selected) await queryClient.invalidateQueries({ queryKey: examKeys.results(selected.id) });
    },
    onError: (e) => setError(getErrorMessage(e, 'Could not save the mark.')),
  });

  const openMarking = async (attemptId: number) => {
    setError('');
    try {
      setMarking(await examApi.resultDetail(attemptId));
    } catch {
      setError('Could not load the attempt.');
    }
  };

  const list = exams.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exams & CBT"
        actions={
          <Button icon={<Plus size={16} aria-hidden="true" />} onClick={() => setShowForm((s) => !s)}>
            New Exam
          </Button>
        }
      />

      {exams.isError && <Alert tone="error">Could not load exams. Please retry.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {showForm && (
        <ExamForm
          saving={create.isPending}
          onSubmit={(exam) => {
            setError('');
            create.mutate(exam);
          }}
          onCancel={() => setShowForm(false)}
          onInvalid={setError}
        />
      )}

      {exams.isLoading ? (
        <LoadingState />
      ) : list.length === 0 ? (
        <EmptyState icon={<FileText size={48} />} title="No exams yet. Create your first exam to get started." />
      ) : (
        <div className="grid gap-3">
          {list.map((exam) => (
            <Card key={exam.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <button
                  className="text-left"
                  onClick={() => {
                    setError('');
                    setMarking(null);
                    setSelected(exam);
                  }}
                >
                  <span className="font-semibold text-purple-100">{exam.title}</span>
                  <span className="ml-2 text-sm text-purple-300">
                    {exam.subject} · {exam.questionCount} questions · {exam.totalMarks} marks · {exam.durationMinutes}{' '}
                    min
                  </span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={STATUS_TONE[exam.status as keyof typeof STATUS_TONE] ?? 'neutral'}>{exam.status}</Badge>
                {exam.status === 'DRAFT' && (
                  <Button
                    size="sm"
                    variant="success"
                    icon={<Send size={14} aria-hidden="true" />}
                    onClick={() => changeStatus.mutate({ exam, action: 'publish' })}
                  >
                    Publish
                  </Button>
                )}
                {exam.status === 'PUBLISHED' && (
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<Lock size={14} aria-hidden="true" />}
                    onClick={() => changeStatus.mutate({ exam, action: 'close' })}
                  >
                    Close
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <Card padding="lg" className="space-y-4" role="region" aria-label={`Results for ${selected.title}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-purple-100">{selected.title} — Results</h2>
            <button onClick={() => setSelected(null)} className="text-purple-300">
              Close
            </button>
          </div>
          {results.isLoading ? (
            <LoadingState label="Loading results…" />
          ) : results.isError ? (
            <p className="text-danger">Could not load exam details.</p>
          ) : (results.data ?? []).length === 0 ? (
            <p className="text-purple-300">No attempts yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-purple-300">
                  <th className="py-2">Learner</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Score</th>
                  <th className="py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.data!.map((r) => (
                  <tr key={r.attemptId} className="border-t border-purple-500/20 text-purple-100">
                    <td className="py-2">{r.studentName}</td>
                    <td className="py-2">{r.status}</td>
                    <td className="py-2">{r.score == null ? '—' : `${r.score} / ${r.totalMarks}`}</td>
                    <td className="py-2">
                      {r.status !== 'IN_PROGRESS' && (
                        <button onClick={() => openMarking(r.attemptId)} className="text-sm text-purple-300 underline">
                          Review
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {marking && (
        <MarkingPanel
          key={marking.attemptId}
          attempt={marking}
          saving={mark.isPending}
          onSave={(questionId, marks, feedback) => {
            setError('');
            mark.mutate({ questionId, marks, feedback });
          }}
          onClose={() => setMarking(null)}
          onInvalid={setError}
        />
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { Alert, Button, Card, EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { examApi, examKeys, type AttemptDetail, type ExamSummary, type StartedAttempt } from '../api';
import { ExamAttempt } from '../components/ExamAttempt';

async function loadLearnerExams() {
  const [available, results] = await Promise.all([examApi.available(), examApi.myResults()]);
  return { available, results };
}

export default function StudentExamsScreen() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: examKeys.learner, queryFn: loadLearnerExams });
  const [attempt, setAttempt] = useState<StartedAttempt | null>(null);
  const [finished, setFinished] = useState<{ score: number | null; totalMarks: number } | null>(null);
  const [resultDetail, setResultDetail] = useState<AttemptDetail | null>(null);
  const [error, setError] = useState('');

  const refresh = () => queryClient.invalidateQueries({ queryKey: examKeys.learner });

  const startExam = async (exam: ExamSummary) => {
    setError('');
    try {
      const started = await examApi.start(exam.id);
      setFinished(null);
      setAttempt(started);
      // Offer fullscreen exam mode (best-effort; browser lockdown is not absolute).
      document.documentElement.requestFullscreen?.().catch(() => undefined);
    } catch (e) {
      setError(getErrorMessage(e, 'Could not start the exam.'));
    }
  };

  const openResult = async (attemptId: number) => {
    setError('');
    try {
      setResultDetail(await examApi.resultDetail(attemptId));
    } catch {
      setError('Could not load the result.');
    }
  };

  const available = data?.available ?? [];
  const results = data?.results ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="My Exams" />

      {isError && <Alert tone="error">Could not load exams. Please retry.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {finished && (
        <Card padding="lg" className="text-center">
          <p className="text-lg font-semibold text-purple-100">Exam submitted</p>
          <p className="mt-1 text-purple-300">
            Score: {finished.score ?? '—'} / {finished.totalMarks}
          </p>
          <p className="mt-2 text-sm text-purple-400">Short-answer questions are marked by your teacher.</p>
        </Card>
      )}

      {attempt ? (
        <ExamAttempt
          attempt={attempt}
          onFinished={(res) => {
            setFinished(res);
            setAttempt(null);
            void refresh();
          }}
          onAbandoned={(message) => {
            setError(message);
            setAttempt(null);
            void refresh();
          }}
        />
      ) : isLoading ? (
        <LoadingState />
      ) : available.length === 0 && results.length === 0 ? (
        <EmptyState icon={<FileText size={48} />} title="No exams available right now." />
      ) : (
        <>
          {available.length > 0 && (
            <div className="grid gap-3">
              {available.map((exam) => (
                <Card key={exam.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-purple-100">{exam.title}</p>
                    <p className="text-sm text-purple-300">
                      {exam.subject} · {exam.questionCount} questions · {exam.totalMarks} marks · {exam.durationMinutes}{' '}
                      min
                    </p>
                    {exam.description && <p className="mt-1 text-sm text-purple-300">{exam.description}</p>}
                  </div>
                  <Button onClick={() => startExam(exam)}>Start exam</Button>
                </Card>
              ))}
            </div>
          )}
          {results.length > 0 && (
            <Card title="Past results">
              <ul className="space-y-1 text-sm text-purple-200">
                {results.map((r) => (
                  <li
                    key={r.attemptId}
                    className="flex items-center justify-between border-b border-purple-500/10 py-1"
                  >
                    <button className="text-left underline" onClick={() => openResult(r.attemptId)}>
                      {r.examTitle}
                    </button>
                    <span>
                      {r.status === 'SUBMITTED' && r.score != null
                        ? `${r.score} / ${r.totalMarks}`
                        : r.status === 'TIMED_OUT'
                          ? 'Timed out'
                          : 'Marking…'}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {resultDetail && (
        <Card padding="lg" className="space-y-3" role="region" aria-label={`Result for ${resultDetail.examTitle}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-purple-100">
              {resultDetail.examTitle} — {resultDetail.score ?? '—'} / {resultDetail.totalMarks}
            </h2>
            <button onClick={() => setResultDetail(null)} className="text-purple-300">
              Close
            </button>
          </div>
          {resultDetail.breakdown.map((b) => (
            <div key={b.questionId} className="rounded-lg border border-purple-500/20 p-3">
              <p className="text-sm text-purple-100">{b.question}</p>
              <p className="mt-1 text-sm text-purple-300">
                Your answer: <span className="text-purple-100">{b.studentAnswer || '—'}</span>
                {' · '}
                {b.qtype === 'SHORT_ANSWER'
                  ? b.marksAwarded != null
                    ? `${b.marksAwarded}/${b.marksPossible} (teacher marked)`
                    : 'Awaiting teacher marking'
                  : b.correct
                    ? `Correct · ${b.marksAwarded ?? 0}/${b.marksPossible}`
                    : `Not correct · 0/${b.marksPossible}`}
              </p>
              {b.feedback && <p className="mt-1 text-sm italic text-purple-200">Teacher: {b.feedback}</p>}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Button, Card, TextInput } from '@/components/ui';
import type { AttemptDetail } from '../api';

type MarkValue = { marks: string; feedback: string };

/** Teacher marking of short-answer questions for one attempt. */
export function MarkingPanel({
  attempt,
  saving,
  onSave,
  onClose,
  onInvalid,
}: {
  attempt: AttemptDetail;
  saving: boolean;
  onSave: (questionId: number, marks: number, feedback?: string) => void;
  onClose: () => void;
  onInvalid: (message: string) => void;
}) {
  const [values, setValues] = useState<Record<number, MarkValue>>(() => {
    const init: Record<number, MarkValue> = {};
    attempt.breakdown
      .filter((b) => b.qtype === 'SHORT_ANSWER')
      .forEach((b) => {
        init[b.questionId] = {
          marks: b.marksAwarded == null ? '' : String(b.marksAwarded),
          feedback: b.feedback || '',
        };
      });
    return init;
  });

  const update = (questionId: number, patch: Partial<MarkValue>) =>
    setValues((m) => ({
      ...m,
      [questionId]: { marks: m[questionId]?.marks ?? '', feedback: m[questionId]?.feedback ?? '', ...patch },
    }));

  const save = (questionId: number, max: number) => {
    const v = values[questionId];
    const marks = Number(v?.marks);
    if (v?.marks === '' || Number.isNaN(marks) || marks < 0 || marks > max) {
      onInvalid(`Enter marks between 0 and ${max}.`);
      return;
    }
    onSave(questionId, marks, v.feedback || undefined);
  };

  return (
    <Card padding="lg" className="space-y-4" role="region" aria-label={`Marking attempt for ${attempt.studentName}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-purple-100">
          {attempt.studentName} — {attempt.score ?? '—'} / {attempt.totalMarks}
        </h2>
        <button onClick={onClose} className="text-purple-300">
          Close
        </button>
      </div>
      {attempt.breakdown.map((b) => (
        <div key={b.questionId} className="space-y-2 rounded-lg border border-purple-500/20 p-3">
          <p className="text-sm font-medium text-purple-100">{b.question}</p>
          <p className="text-sm text-purple-300">
            Learner answer: <span className="text-purple-100">{b.studentAnswer || '—'}</span>
            {b.qtype !== 'SHORT_ANSWER' && (
              <span className="ml-2">
                · {b.marksAwarded ?? 0}/{b.marksPossible}
              </span>
            )}
          </p>
          {b.qtype === 'SHORT_ANSWER' && (
            <div className="flex flex-wrap items-center gap-2">
              <TextInput
                type="number"
                min={0}
                max={b.marksPossible}
                step="0.5"
                aria-label={`Marks for question: ${b.question}`}
                className="w-24 py-1.5"
                placeholder={`0-${b.marksPossible}`}
                value={values[b.questionId]?.marks ?? ''}
                onChange={(e) => update(b.questionId, { marks: e.target.value })}
              />
              <TextInput
                className="min-w-[200px] flex-1 py-1.5"
                placeholder="Feedback for the learner (optional)"
                aria-label={`Feedback for question: ${b.question}`}
                value={values[b.questionId]?.feedback ?? ''}
                onChange={(e) => update(b.questionId, { feedback: e.target.value })}
              />
              <Button size="sm" loading={saving} onClick={() => save(b.questionId, b.marksPossible)}>
                {b.marksAwarded != null ? 'Update mark' : 'Save mark'}
              </Button>
            </div>
          )}
          {b.feedback && b.qtype === 'SHORT_ANSWER' && (
            <p className="text-xs text-purple-300">Current feedback: {b.feedback}</p>
          )}
        </div>
      ))}
    </Card>
  );
}

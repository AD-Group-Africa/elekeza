'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Card, Field, Select, TextInput, Textarea } from '@/components/ui';
import type { NewExam } from '../api';

type QuestionForm = {
  question: string;
  qtype: string;
  options: string[];
  correctOption: string;
  correctText: string;
  marks: number;
};

const EMPTY_FORM = { title: '', subject: '', description: '', durationMinutes: 30, maxAttempts: 1 };
const newQuestion = (): QuestionForm => ({
  question: '',
  qtype: 'MCQ',
  options: ['', ''],
  correctOption: 'A',
  correctText: '',
  marks: 1,
});

/** Builds an exam with MCQ / true-false / short-answer questions. */
export function ExamForm({
  saving,
  onSubmit,
  onCancel,
  onInvalid,
}: {
  saving: boolean;
  onSubmit: (exam: NewExam) => void;
  onCancel: () => void;
  onInvalid: (message: string) => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [questions, setQuestions] = useState<QuestionForm[]>([newQuestion()]);

  const updateQuestion = (idx: number, patch: Partial<QuestionForm>) =>
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)));

  const submit = () => {
    if (!form.title.trim() || !form.subject.trim()) {
      onInvalid('Title and subject are required.');
      return;
    }
    onSubmit({
      title: form.title,
      subject: form.subject,
      description: form.description || null,
      durationMinutes: Number(form.durationMinutes) || 30,
      maxAttempts: Number(form.maxAttempts) || 1,
      questions: questions.map((q) => ({
        question: q.question,
        qtype: q.qtype,
        options: q.qtype === 'MCQ' ? q.options.filter((o) => o.trim()) : [],
        correctOption: q.qtype === 'SHORT_ANSWER' ? null : q.correctOption,
        correctText: q.qtype === 'SHORT_ANSWER' ? q.correctText : null,
        marks: Number(q.marks) || 1,
      })),
    });
  };

  return (
    <Card padding="lg" title="Create Exam" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="exam-title" label="Title">
          <TextInput id="exam-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field id="exam-subject" label="Subject">
          <TextInput
            id="exam-subject"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
        </Field>
        <Field id="exam-duration" label="Duration (minutes)">
          <TextInput
            id="exam-duration"
            type="number"
            min={1}
            max={300}
            value={form.durationMinutes}
            onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
          />
        </Field>
        <Field id="exam-attempts" label="Max attempts (1-5)">
          <TextInput
            id="exam-attempts"
            type="number"
            min={1}
            max={5}
            value={form.maxAttempts}
            onChange={(e) => setForm({ ...form, maxAttempts: Number(e.target.value) })}
          />
        </Field>
      </div>
      <Field id="exam-description" label="Description">
        <Textarea
          id="exam-description"
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </Field>

      <div className="space-y-3">
        {questions.map((q, idx) => (
          <fieldset key={idx} className="space-y-2 rounded-lg border border-purple-500/20 p-3">
            <div className="flex items-center justify-between">
              <legend className="text-sm font-medium text-purple-200">Question {idx + 1}</legend>
              {questions.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove question ${idx + 1}`}
                  onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== idx))}
                >
                  <Trash2 size={16} className="text-red-300" aria-hidden="true" />
                </button>
              )}
            </div>
            <TextInput
              aria-label={`Question ${idx + 1} text`}
              placeholder="Question text"
              value={q.question}
              onChange={(e) => updateQuestion(idx, { question: e.target.value })}
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <Select
                aria-label={`Question ${idx + 1} type`}
                value={q.qtype}
                onChange={(e) => updateQuestion(idx, { qtype: e.target.value })}
              >
                <option value="MCQ">Multiple choice</option>
                <option value="TRUE_FALSE">True / False</option>
                <option value="SHORT_ANSWER">Short answer</option>
              </Select>
              <TextInput
                type="number"
                min={1}
                aria-label={`Marks for question ${idx + 1}`}
                value={q.marks}
                onChange={(e) => updateQuestion(idx, { marks: Number(e.target.value) })}
              />
              {q.qtype !== 'SHORT_ANSWER' && (
                <Select
                  aria-label={`Correct option for question ${idx + 1}`}
                  value={q.correctOption}
                  onChange={(e) => updateQuestion(idx, { correctOption: e.target.value })}
                >
                  {['A', 'B', 'C', 'D']
                    .slice(0, q.qtype === 'TRUE_FALSE' ? 2 : Math.max(2, q.options.length))
                    .map((o) => (
                      <option key={o} value={o}>
                        Correct: {o}
                      </option>
                    ))}
                </Select>
              )}
            </div>
            {q.qtype === 'MCQ' && (
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((opt, oi) => (
                  <TextInput
                    key={oi}
                    aria-label={`Question ${idx + 1} option ${String.fromCharCode(65 + oi)}`}
                    placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                    value={opt}
                    onChange={(e) =>
                      updateQuestion(idx, { options: q.options.map((o, i) => (i === oi ? e.target.value : o)) })
                    }
                  />
                ))}
                {q.options.length < 4 && (
                  <button
                    type="button"
                    className="text-left text-sm text-purple-300 underline"
                    onClick={() => updateQuestion(idx, { options: [...q.options, ''] })}
                  >
                    + Add option
                  </button>
                )}
              </div>
            )}
            {q.qtype === 'SHORT_ANSWER' && (
              <TextInput
                aria-label={`Question ${idx + 1} model answer`}
                placeholder="Model answer (used for auto-marking later)"
                value={q.correctText}
                onChange={(e) => updateQuestion(idx, { correctText: e.target.value })}
              />
            )}
          </fieldset>
        ))}
        <button
          type="button"
          className="text-sm text-purple-300 underline"
          onClick={() => setQuestions((qs) => [...qs, newQuestion()])}
        >
          + Add question
        </button>
      </div>

      <div className="flex gap-2">
        <Button onClick={submit} loading={saving}>
          {saving ? 'Saving…' : 'Create exam'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

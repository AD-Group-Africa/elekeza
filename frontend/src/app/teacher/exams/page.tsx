'use client';

import { useCallback, useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { examAPI } from '@/lib/api';
import { FileText, Plus, Trash2, Send, Lock, Unlock } from 'lucide-react';

interface ExamQuestion {
  id: number;
  question: string;
  qtype: string;
  options: (string | null)[];
  marks: number;
  orderIndex: number;
}

interface ExamRow {
  id: number;
  title: string;
  subject: string;
  description?: string | null;
  durationMinutes: number;
  maxAttempts: number;
  status: string;
  questionCount: number;
  totalMarks: number;
}

interface ExamDetail extends ExamRow {
  questions: ExamQuestion[];
}

interface ResultRow {
  attemptId: number;
  studentName: string;
  status: string;
  score: number | null;
  totalMarks: number;
}

interface BreakdownRow {
  questionId: number;
  question: string;
  qtype: string;
  studentAnswer: string | null;
  marksAwarded: number | null;
  marksPossible: number;
  feedback?: string | null;
}

interface ResultDetail {
  attemptId: number;
  studentName: string;
  status: string;
  score: number | null;
  totalMarks: number;
  breakdown: BreakdownRow[];
}

const emptyForm = { title: '', subject: '', description: '', durationMinutes: 30, maxAttempts: 1 };
const emptyQuestion = { question: '', qtype: 'MCQ', options: ['', ''], correctOption: 'A', correctText: '', marks: 1 };

type QuestionForm = typeof emptyQuestion;

export default function TeacherExams() {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [questions, setQuestions] = useState<QuestionForm[]>([{ ...emptyQuestion }]);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<ExamDetail | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [marking, setMarking] = useState<ResultDetail | null>(null);
  const [markValues, setMarkValues] = useState<Record<number, { marks: string; feedback: string }>>({});
  const [markSaving, setMarkSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    examAPI.list()
      .then(res => setExams(res.data || []))
      .catch(() => setError('Could not load exams. Please retry.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setForm(emptyForm); setQuestions([{ ...emptyQuestion }]); setShowForm(false); };

  const submitExam = async () => {
    if (!form.title.trim() || !form.subject.trim()) {
      setError('Title and subject are required.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      title: form.title,
      subject: form.subject,
      description: form.description || null,
      durationMinutes: Number(form.durationMinutes) || 30,
      maxAttempts: Number(form.maxAttempts) || 1,
      questions: questions.map(q => ({
        question: q.question,
        qtype: q.qtype,
        options: q.qtype === 'MCQ' ? q.options.filter(o => o.trim()) : [],
        correctOption: q.qtype === 'SHORT_ANSWER' ? null : q.correctOption,
        correctText: q.qtype === 'SHORT_ANSWER' ? q.correctText : null,
        marks: Number(q.marks) || 1,
      })),
    };
    try {
      await examAPI.create(payload);
      resetForm();
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Could not create the exam.');
    } finally {
      setSaving(false);
    }
  };

  const updateQuestion = (idx: number, patch: Partial<QuestionForm>) =>
    setQuestions(qs => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)));

  const openDetail = async (exam: ExamRow) => {
    setError('');
    try {
      const res = await examAPI.get(exam.id);
      setDetail(res.data);
      const r = await examAPI.results(exam.id);
      setResults(r.data || []);
    } catch {
      setError('Could not load exam details.');
    }
  };

  const act = async (exam: ExamRow, action: 'publish' | 'close') => {
    setError('');
    try {
      await (action === 'publish' ? examAPI.publish(exam.id) : examAPI.close(exam.id));
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Action failed.');
    }
  };

  const openMarking = async (attemptId: number) => {
    setError('');
    try {
      const res = await examAPI.resultDetail(attemptId);
      const d = res.data as ResultDetail;
      setMarking(d);
      const init: Record<number, { marks: string; feedback: string }> = {};
      d.breakdown.filter(b => b.qtype === 'SHORT_ANSWER').forEach(b => {
        init[b.questionId] = { marks: b.marksAwarded == null ? '' : String(b.marksAwarded), feedback: b.feedback || '' };
      });
      setMarkValues(init);
    } catch {
      setError('Could not load the attempt.');
    }
  };

  const saveMark = async (questionId: number) => {
    if (!marking) return;
    const v = markValues[questionId];
    const marks = Number(v?.marks);
    if (v?.marks === '' || Number.isNaN(marks) || marks < 0) {
      setError('Enter marks between 0 and the question maximum.');
      return;
    }
    setMarkSaving(true);
    setError('');
    try {
      const res = await examAPI.mark(marking.attemptId, questionId, marks, v.feedback || undefined);
      setMarking(res.data as ResultDetail);
      const refreshed = await examAPI.results(detail!.id);
      setResults(refreshed.data || []);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Could not save the mark.');
    } finally {
      setMarkSaving(false);
    }
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-purple-200">Exams &amp; CBT</h1>
          <button
            onClick={() => setShowForm(s => !s)}
            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Plus size={16} /> New Exam
          </button>
        </div>

        {error && (
          <div role="alert" className="bg-red-500/20 border border-red-500/40 text-red-200 rounded-lg p-3 text-sm">{error}</div>
        )}

        {showForm && (
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-purple-100">Create Exam</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-purple-200">Title
                <input className="mt-1 w-full bg-purple-900/40 border border-purple-500/30 rounded-lg px-3 py-2 text-purple-100"
                  value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="text-sm text-purple-200">Subject
                <input className="mt-1 w-full bg-purple-900/40 border border-purple-500/30 rounded-lg px-3 py-2 text-purple-100"
                  value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
              </label>
              <label className="text-sm text-purple-200">Duration (minutes)
                <input type="number" min={1} max={300} className="mt-1 w-full bg-purple-900/40 border border-purple-500/30 rounded-lg px-3 py-2 text-purple-100"
                  value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: Number(e.target.value) })} />
              </label>
              <label className="text-sm text-purple-200">Max attempts (1-5)
                <input type="number" min={1} max={5} className="mt-1 w-full bg-purple-900/40 border border-purple-500/30 rounded-lg px-3 py-2 text-purple-100"
                  value={form.maxAttempts} onChange={e => setForm({ ...form, maxAttempts: Number(e.target.value) })} />
              </label>
            </div>
            <label className="block text-sm text-purple-200">Description
              <textarea className="mt-1 w-full bg-purple-900/40 border border-purple-500/30 rounded-lg px-3 py-2 text-purple-100" rows={2}
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </label>

            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div key={idx} className="border border-purple-500/20 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-purple-200">Question {idx + 1}</span>
                    {questions.length > 1 && (
                      <button aria-label={`Remove question ${idx + 1}`} onClick={() => setQuestions(qs => qs.filter((_, i) => i !== idx))}>
                        <Trash2 size={16} className="text-red-300" />
                      </button>
                    )}
                  </div>
                  <input className="w-full bg-purple-900/40 border border-purple-500/30 rounded-lg px-3 py-2 text-purple-100"
                    placeholder="Question text" value={q.question} onChange={e => updateQuestion(idx, { question: e.target.value })} />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <select className="bg-purple-900/40 border border-purple-500/30 rounded-lg px-2 py-2 text-purple-100"
                      value={q.qtype} onChange={e => updateQuestion(idx, { qtype: e.target.value })}>
                      <option value="MCQ">Multiple choice</option>
                      <option value="TRUE_FALSE">True / False</option>
                      <option value="SHORT_ANSWER">Short answer</option>
                    </select>
                    <input type="number" min={1} className="bg-purple-900/40 border border-purple-500/30 rounded-lg px-3 py-2 text-purple-100"
                      aria-label={`Marks for question ${idx + 1}`} value={q.marks}
                      onChange={e => updateQuestion(idx, { marks: Number(e.target.value) })} />
                    {q.qtype !== 'SHORT_ANSWER' && (
                      <select className="bg-purple-900/40 border border-purple-500/30 rounded-lg px-2 py-2 text-purple-100"
                        aria-label={`Correct option for question ${idx + 1}`} value={q.correctOption}
                        onChange={e => updateQuestion(idx, { correctOption: e.target.value })}>
                        {['A', 'B', 'C', 'D'].slice(0, q.qtype === 'TRUE_FALSE' ? 2 : Math.max(2, q.options.length)).map(o => (
                          <option key={o} value={o}>Correct: {o}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  {q.qtype === 'MCQ' && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {q.options.map((opt, oi) => (
                        <input key={oi} className="bg-purple-900/40 border border-purple-500/30 rounded-lg px-3 py-2 text-purple-100"
                          placeholder={`Option ${String.fromCharCode(65 + oi)}`} value={opt}
                          onChange={e => updateQuestion(idx, { options: q.options.map((o, i) => (i === oi ? e.target.value : o)) })} />
                      ))}
                      {q.options.length < 4 && (
                        <button className="text-purple-300 text-sm underline text-left"
                          onClick={() => updateQuestion(idx, { options: [...q.options, ''] })}>+ Add option</button>
                      )}
                    </div>
                  )}
                  {q.qtype === 'SHORT_ANSWER' && (
                    <input className="w-full bg-purple-900/40 border border-purple-500/30 rounded-lg px-3 py-2 text-purple-100"
                      placeholder="Model answer (used for auto-marking later)" value={q.correctText}
                      onChange={e => updateQuestion(idx, { correctText: e.target.value })} />
                  )}
                </div>
              ))}
              <button className="text-purple-300 text-sm underline" onClick={() => setQuestions(qs => [...qs, { ...emptyQuestion, options: ['', ''] }])}>
                + Add question
              </button>
            </div>

            <div className="flex gap-2">
              <button disabled={saving} onClick={submitExam}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg">
                {saving ? 'Saving…' : 'Create exam'}
              </button>
              <button onClick={resetForm} className="text-purple-300 px-4 py-2">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-purple-300">Loading…</p>
        ) : exams.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <FileText size={48} className="text-purple-400 mx-auto mb-4" />
            <p className="text-purple-200">No exams yet. Create your first exam to get started.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {exams.map(exam => (
              <div key={exam.id} className="glass-card p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <button className="text-left" onClick={() => openDetail(exam)}>
                    <span className="font-semibold text-purple-100">{exam.title}</span>
                    <span className="ml-2 text-sm text-purple-300">{exam.subject} · {exam.questionCount} questions · {exam.totalMarks} marks · {exam.durationMinutes} min</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full border ${
                    exam.status === 'PUBLISHED' ? 'bg-green-500/20 border-green-500/40 text-green-200'
                    : exam.status === 'CLOSED' ? 'bg-gray-500/20 border-gray-500/40 text-gray-300'
                    : 'bg-yellow-500/20 border-yellow-500/40 text-yellow-200'}`}>
                    {exam.status}
                  </span>
                  {exam.status === 'DRAFT' && (
                    <button onClick={() => act(exam, 'publish')} className="bg-green-600/80 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-sm">
                      <Send size={14} /> Publish
                    </button>
                  )}
                  {exam.status === 'PUBLISHED' && (
                    <button onClick={() => act(exam, 'close')} className="bg-red-600/80 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-sm">
                      <Lock size={14} /> Close
                    </button>
                  )}
                  {exam.status === 'CLOSED' && <Unlock size={14} className="text-gray-400" aria-label="Closed" />}
                </div>
              </div>
            ))}
          </div>
        )}

        {detail && (
          <div className="glass-card p-6 space-y-4" role="dialog" aria-label={`Results for ${detail.title}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-purple-100">{detail.title} — Results</h2>
              <button onClick={() => setDetail(null)} className="text-purple-300">Close</button>
            </div>
            {results.length === 0 ? (
              <p className="text-purple-300">No attempts yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="text-purple-300 text-left">
                  <th className="py-2">Learner</th><th className="py-2">Status</th><th className="py-2">Score</th>
                </tr></thead>
                <tbody>
                  {results.map(r => (
                    <tr key={r.attemptId} className="border-t border-purple-500/20 text-purple-100">
                      <td className="py-2">{r.studentName}</td>
                      <td className="py-2">{r.status}</td>
                      <td className="py-2">{r.score == null ? '—' : `${r.score} / ${r.totalMarks}`}</td>
                      <td className="py-2">
                        {r.status !== 'IN_PROGRESS' && (
                          <button onClick={() => openMarking(r.attemptId)} className="text-purple-300 underline text-sm">Review</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {marking && (
          <div className="glass-card p-6 space-y-4" role="dialog" aria-label={`Marking attempt for ${marking.studentName}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-purple-100">{marking.studentName} — {marking.score ?? '—'} / {marking.totalMarks}</h2>
              <button onClick={() => setMarking(null)} className="text-purple-300">Close</button>
            </div>
            {marking.breakdown.map(b => (
              <div key={b.questionId} className="border border-purple-500/20 rounded-lg p-3 space-y-2">
                <p className="text-purple-100 text-sm font-medium">{b.question}</p>
                <p className="text-purple-300 text-sm">
                  Learner answer: <span className="text-purple-100">{b.studentAnswer || '—'}</span>
                  {b.qtype !== 'SHORT_ANSWER' && (
                    <span className="ml-2">· {b.marksAwarded != null ? `${b.marksAwarded}/${b.marksPossible}` : '0/' + b.marksPossible}</span>
                  )}
                </p>
                {b.qtype === 'SHORT_ANSWER' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number" min={0} max={b.marksPossible} step="0.5"
                      aria-label={`Marks for question: ${b.question}`}
                      className="w-24 bg-purple-900/40 border border-purple-500/30 rounded-lg px-2 py-1.5 text-purple-100"
                      placeholder={`0-${b.marksPossible}`}
                      value={markValues[b.questionId]?.marks ?? ''}
                      onChange={e => setMarkValues(m => ({ ...m, [b.questionId]: { marks: e.target.value, feedback: m[b.questionId]?.feedback || '' } }))}
                    />
                    <input
                      className="flex-1 min-w-[200px] bg-purple-900/40 border border-purple-500/30 rounded-lg px-3 py-1.5 text-purple-100"
                      placeholder="Feedback for the learner (optional)"
                      aria-label={`Feedback for question: ${b.question}`}
                      value={markValues[b.questionId]?.feedback ?? ''}
                      onChange={e => setMarkValues(m => ({ ...m, [b.questionId]: { marks: m[b.questionId]?.marks || '', feedback: e.target.value } }))}
                    />
                    <button disabled={markSaving} onClick={() => saveMark(b.questionId)}
                      className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm">
                      {markSaving ? 'Saving…' : b.marksAwarded != null ? 'Update mark' : 'Save mark'}
                    </button>
                  </div>
                )}
                {b.feedback && b.qtype === 'SHORT_ANSWER' && (
                  <p className="text-purple-300 text-xs">Current feedback: {b.feedback}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}

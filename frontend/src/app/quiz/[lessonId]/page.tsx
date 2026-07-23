'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { ClipboardCheck, ChevronRight, AlertTriangle } from 'lucide-react';

export default function QuizPage() {
  const { lessonId } = useParams();
  const router = useRouter();
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/quiz/' + lessonId + '/start')
      .then(res => setQuiz(res.data))
      .catch(err => { console.error(err); setError('Failed to load quiz. This lesson may not have questions yet.'); })
      .finally(() => setLoading(false));
  }, [lessonId]);

  const handleAnswer = (optionIdx: number) => {
    setAnswers(prev => ({ ...prev, [currentQ]: optionIdx }));
    setTimeout(() => {
      if (currentQ < quiz.questions.length - 1) {
        setCurrentQ(prev => prev + 1);
      }
    }, 400);
  };

  const handleSubmit = async () => {
    if (!quiz || !quiz.quizId) return;
    const answersArray = quiz.questions.map((q: any, idx: number) => ({
      questionId: q.id,
      selectedOption: answers[idx] ?? 0, // default to 0 instead of -1
    }));
    try {
      const res = await api.post('/quiz/' + quiz.quizId + '/complete', answersArray);
      setScore(res.data.score);
      setSubmitted(true);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to submit quiz. Please try again.');
    }
  };

  const getOptions = (q: any): string[] => {
    if (!q.options) return [];
    if (Array.isArray(q.options)) return q.options;
    if (typeof q.options === 'string') return q.options.split('\n').filter((o: string) => o.trim().length > 0);
    return [];
  };

  if (loading) return <SidebarLayout><div className="p-6 text-purple-200">Loading quiz…</div></SidebarLayout>;
  if (error && !quiz) return <SidebarLayout><div className="p-6 text-red-400">{error}</div></SidebarLayout>;
  if (!quiz) return <SidebarLayout><div className="p-6 text-red-400">Quiz not found.</div></SidebarLayout>;

  const q = quiz.questions[currentQ];
  const options = getOptions(q);

  return (
    <SidebarLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-purple-200">{quiz.title || 'Quiz'}</h1>
        {submitted ? (
          <div className="glass-card p-6 text-center">
            <ClipboardCheck size={48} className="text-green-400 mx-auto mb-4" />
            <p className="text-xl text-purple-200 mb-2">Quiz Completed!</p>
            <p className="text-3xl font-bold text-purple-100">{score}%</p>
            <button
              onClick={() => router.push('/quiz/review/' + quiz.quizId)}
              className="mt-4 bg-purple-600 text-white px-6 py-2 rounded-lg"
            >
              Review Answers
            </button>
          </div>
        ) : (
          <>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all"
                style={{ width: ((currentQ + 1) / quiz.questions.length) * 100 + '%' }}
              />
            </div>
            <p className="text-purple-300 text-sm">Question {currentQ + 1} of {quiz.questions.length}</p>

            {error && (
              <div className="bg-red-600/20 border border-red-400/40 p-3 rounded flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-400" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div className="glass-card p-6">
              <p className="text-lg font-semibold text-purple-200 mb-6">{q.questionText || q.question}</p>
              <div className="space-y-3">
                {options.map((opt: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    className={
                      'w-full text-left px-4 py-3 rounded-lg transition border ' +
                      (answers[currentQ] === idx
                        ? 'bg-purple-600/40 border-purple-500 text-white'
                        : 'bg-white/5 border-purple-300/20 text-purple-200 hover:bg-white/10')
                    }
                  >
                    <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setCurrentQ(prev => Math.max(0, prev - 1))}
                disabled={currentQ === 0}
                className="text-purple-300 disabled:opacity-30"
              >
                Previous
              </button>
              {currentQ === quiz.questions.length - 1 ? (
                <button
                  onClick={handleSubmit}
                  disabled={Object.keys(answers).length < quiz.questions.length}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg disabled:opacity-50"
                >
                  Submit Quiz
                </button>
              ) : (
                <button
                  onClick={() => setCurrentQ(prev => prev + 1)}
                  className="text-purple-300 flex items-center gap-1"
                >
                  Next <ChevronRight size={18} />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </SidebarLayout>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { ChevronRight, ChevronLeft, SkipForward, Check, X, Award } from 'lucide-react';

export default function QuizPage() {
  const { lessonId } = useParams();
  const router = useRouter();
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    api.get('/quiz/' + lessonId + '/start')
      .then(res => setQuiz(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [lessonId]);

  const handleAnswer = (optionIdx: number) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [currentQ]: optionIdx }));
    // Auto‑advance after a short delay
    setTimeout(() => {
      if (currentQ < (quiz?.questions?.length || 1) - 1) {
        setCurrentQ(prev => prev + 1);
      }
    }, 500);
  };

  const handleSubmit = async () => {
    if (!quiz) return;
    const answersArray = quiz.questions.map((q: any, idx: number) => ({
      questionId: q.id,
      selectedOption: answers[idx] ?? -1,
    }));
    try {
      const res = await api.post('/quiz/' + quiz.quizId + '/complete', answersArray);
      setScore(res.data.score);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSkip = () => {
    if (currentQ < (quiz?.questions?.length || 1) - 1) {
      setCurrentQ(prev => prev + 1);
    }
  };

  if (loading) return <SidebarLayout><div className="p-6 text-purple-200">Loading quiz…</div></SidebarLayout>;
  if (!quiz) return <SidebarLayout><div className="p-6 text-red-400">Quiz not found.</div></SidebarLayout>;

  const q = quiz.questions[currentQ];
  const options = q.options ? (Array.isArray(q.options) ? q.options : q.options.split('\n').filter((o: string) => o.trim().length > 0)) : [];

  return (
    <SidebarLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Progress Bar */}
        <div className="flex items-center gap-2">
          <span className="text-purple-300 text-sm">{currentQ + 1} / {quiz.questions.length}</span>
          <div className="flex-1 bg-white/10 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all"
              style={{ width: ((currentQ + 1) / quiz.questions.length) * 100 + '%' }}
            />
          </div>
        </div>

        {submitted ? (
          <div className="glass-card p-8 text-center">
            <Award size={64} className="text-yellow-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-purple-200 mb-2">Quiz Complete!</h2>
            <p className="text-3xl font-bold text-purple-100">{score}%</p>
            <p className="text-purple-300 mt-2">Great effort! Keep up the good work.</p>
            <button
              onClick={() => router.push('/quiz/review/' + quiz.quizId)}
              className="mt-6 bg-purple-600 text-white px-6 py-3 rounded-lg"
            >
              Review Answers
            </button>
          </div>
        ) : (
          <>
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-purple-200 mb-6">{q.questionText || q.question}</h2>
              <div className="space-y-3">
                {options.map((opt: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    className={
                      'w-full text-left p-4 rounded-lg border transition ' +
                      (answers[currentQ] === idx
                        ? 'bg-purple-600/40 border-purple-500 text-white'
                        : 'bg-white/5 border-purple-300/20 text-purple-200 hover:bg-white/10')
                    }
                  >
                    <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span> {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setCurrentQ(prev => Math.max(0, prev - 1))}
                disabled={currentQ === 0}
                className="text-purple-300 disabled:opacity-30 flex items-center gap-1"
              >
                <ChevronLeft size={18} /> Previous
              </button>
              <button onClick={handleSkip} className="text-purple-300 flex items-center gap-1">
                Skip <SkipForward size={18} />
              </button>
              {currentQ === quiz.questions.length - 1 ? (
                <button
                  onClick={handleSubmit}
                  disabled={Object.keys(answers).length < quiz.questions.length}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg disabled:opacity-50"
                >
                  Submit
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
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function QuizPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [quizId, setQuizId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && user.role !== 'STUDENT' && user.role !== 'TEACHER') {
      router.push('/guardian');
    }
  }, [user, router]);

  useEffect(() => {
    if (!lessonId) return;
    api.get(`/quiz/${lessonId}/start`)
      .then(res => {
        setQuizId(res.data.quizId);
        setQuestions(res.data.questions || []);
      })
      .catch(() => setError('Failed to load quiz. Is the backend running?'))
      .finally(() => setLoading(false));
  }, [lessonId]);

  const handleAnswer = async (optionId: string) => {
    const question = questions[currentIdx];
    const newAnswers = { ...answers, [question.id]: optionId };
    setAnswers(newAnswers);
    try { await api.post(`/quiz/${quizId}/answer`, { questionId: question.id, selectedOptionId: optionId }); } catch {}
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(currentIdx + 1);
    } else {
      try {
        const res = await api.post(`/quiz/${quizId}/complete`);
        setScore(res.data.score || 0);
      } catch {
        const correct = questions.filter((q: any) => (answers as any)[q.id] === q.correctOptionId).length;
        setScore(Math.round((correct / questions.length) * 100));
      }
    }
  };

  if (loading) return <SidebarLayout><div className="text-white text-center mt-20">Loading quiz...</div></SidebarLayout>;
  if (error) return <SidebarLayout><div className="card text-center mt-20 text-red-600">{error}</div></SidebarLayout>;
  if (score !== null) {
    return (
      <SidebarLayout>
        <div className="card max-w-md mx-auto text-center">
          <h2 className="text-2xl font-bold text-blue-900 mb-4">Quiz Complete!</h2>
          <p className="text-4xl font-bold text-purple-600 mb-6">{score}%</p>
          <button onClick={() => router.push('/dashboard')} className="btn-primary">View Progress</button>
        </div>
      </SidebarLayout>
    );
  }

  const q = questions[currentIdx];
  return (
    <SidebarLayout>
      <div className="card max-w-2xl mx-auto">
        <h2 className="text-lg font-semibold text-blue-900 mb-4">Question {currentIdx + 1} of {questions.length}</h2>
        <p className="text-xl mb-6">{q.questionText}</p>
        <div className="space-y-3">
          {q.options.map((opt: string, idx: number) => (
            <button key={idx} onClick={() => handleAnswer(String.fromCharCode(65 + idx))}
              className="block w-full text-left p-4 border border-gray-200 rounded-xl hover:bg-blue-50 transition">
              {String.fromCharCode(65 + idx)}. {opt}
            </button>
          ))}
        </div>
      </div>
    </SidebarLayout>
  );
}

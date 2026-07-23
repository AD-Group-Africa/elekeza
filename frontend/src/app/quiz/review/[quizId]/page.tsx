'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { ArrowLeft, Check, X } from 'lucide-react';
import Link from 'next/link';

export default function QuizReview() {
  const { quizId } = useParams();
  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/quiz/${quizId}/review`)
      .then(res => setReview(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [quizId]);

  if (loading) return <SidebarLayout><div className="p-6 text-purple-200">Loading review…</div></SidebarLayout>;

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <Link href="/student-home" className="flex items-center gap-2 text-purple-300 hover:text-white">
          <ArrowLeft size={18} /> Back
        </Link>
        <h1 className="text-2xl font-bold text-purple-200">Quiz Review</h1>
        {review?.questions.map((q: any, idx: number) => (
          <div key={idx} className="glass-card p-4">
            <div className="flex items-start gap-2">
              {q.correct ? (
                <Check size={20} className="text-green-400 mt-1" />
              ) : (
                <X size={20} className="text-red-400 mt-1" />
              )}
              <div>
                <p className="text-purple-200 font-semibold">{q.question}</p>
                <p className="text-purple-300 text-sm">Your answer: {q.userAnswer}</p>
                {!q.correct && <p className="text-green-300 text-sm">Correct: {q.correctAnswer}</p>}
                {q.explanation && <p className="text-purple-400 text-xs mt-1">{q.explanation}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </SidebarLayout>
  );
}
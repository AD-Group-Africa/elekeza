'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, X } from 'lucide-react';
import { Card, LoadingState, PageHeader } from '@/components/ui';
import { quizApi, quizKeys } from '../api';

/** A completed quiz attempt: each answer, the correct answer and why. */
export default function QuizReviewScreen() {
  const { quizId } = useParams<{ quizId: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: quizKeys.review(quizId),
    queryFn: () => quizApi.review(quizId),
  });

  if (isLoading) return <LoadingState label="Loading review…" />;

  const questions = data?.questions ?? [];
  return (
    <div className="space-y-6">
      <Link href="/student-home" className="flex items-center gap-2 text-purple-300 hover:text-white">
        <ArrowLeft size={18} aria-hidden="true" /> Back
      </Link>
      <PageHeader title="Quiz Review" />
      {(isError || questions.length === 0) && (
        <p className="text-purple-300" role="status">
          {isError
            ? 'We could not load this review right now. Please try again later.'
            : 'There is nothing to review for this quiz yet.'}
        </p>
      )}
      {questions.map((q, idx) => (
        <Card key={idx}>
          <div className="flex items-start gap-2">
            {q.correct ? (
              <Check size={20} className="mt-1 text-green-400" aria-label="Correct" />
            ) : (
              <X size={20} className="mt-1 text-red-400" aria-label="Incorrect" />
            )}
            <div>
              <p className="font-semibold text-purple-200">{q.question}</p>
              <p className="text-sm text-purple-300">Your answer: {q.userAnswer}</p>
              {!q.correct && <p className="text-sm text-green-300">Correct: {q.correctAnswer}</p>}
              {q.explanation && <p className="mt-1 text-xs text-purple-400">{q.explanation}</p>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

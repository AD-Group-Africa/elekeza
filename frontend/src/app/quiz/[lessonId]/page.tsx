'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { quizAPI } from '@/lib/api';
import { useOfflineSync } from '@/hooks/useOfflineSync';

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctOptionId?: string;
}

export default function QuizPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const { isOnline, queueAnswer } = useOfflineSync();

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const res = await quizAPI.start(lessonId);
        const fetchedQuestions: Question[] = res.data.questions;
        setQuestions(fetchedQuestions);
        const { openDB } = await import('idb');
        const db = await openDB('elekeza-offline', 1, {
          upgrade(db) { db.createObjectStore('quiz-cache', { keyPath: 'lessonId' }); }
        });
        db.put('quiz-cache', { lessonId, questions: fetchedQuestions });
      } catch (e) {
        const { openDB } = await import('idb');
        const db = await openDB('elekeza-offline', 1);
        const cached = await db.get('quiz-cache', lessonId);
        if (cached) setQuestions(cached.questions);
      }
    };
    fetchQuiz();
  }, [lessonId]);

  const handleAnswer = async (optionId: string) => {
    const question = questions[currentIdx];
    const newAnswers = { ...answers, [question.id]: optionId };
    setAnswers(newAnswers);

    if (isOnline) {
      await quizAPI.answer(lessonId, question.id, optionId, 0);
    } else {
      queueAnswer(lessonId, question.id, optionId);
    }

    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(currentIdx + 1);
    } else {
      const canScoreLocally = questions.every(q => q.correctOptionId !== undefined);
      if (canScoreLocally) {
        let correct = 0;
        questions.forEach(q => {
          if (newAnswers[q.id] === q.correctOptionId) correct++;
        });
        setScore(Math.round((correct / questions.length) * 100));
      } else {
        setScore(-1);
      }
      setQuizCompleted(true);

      if (isOnline) {
        await quizAPI.complete(lessonId);
      } else {
        queueAnswer(lessonId, 'complete', '');
      }
    }
  };

  if (quizCompleted) {
    return (
      <div className="p-6 text-center text-2xl">
        {score !== null && score >= 0 ? `Your score: ${score}%` : 'Answers saved. They will sync when online.'}
      </div>
    );
  }

  if (!questions.length) return <div>Loading quiz...</div>;

  const q = questions[currentIdx];
  return (
    <div className="p-4">
      <p className="text-xl mb-4">{q.questionText}</p>
      {q.options.map((opt: string, idx: number) => (
        <button
          key={idx}
          onClick={() => handleAnswer(String(idx))}
          className="block w-full text-left p-3 border rounded mb-2"
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

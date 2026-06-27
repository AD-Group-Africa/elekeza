'use client';

import { useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';

export default function ExamPage() {
  const [session, setSession] = useState<any>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [finished, setFinished] = useState(false);

  const startExam = async () => {
    const res = await api.post('/api/exam/start');
    setSession(res.data);
  };

  const answer = (optionIdx: string) => {
    if (!session) return;
    const question = session.questions[currentQ];
    const newAnswers = { ...answers, [question.id]: optionIdx };
    setAnswers(newAnswers);
    if (currentQ + 1 < session.questions.length) {
      setCurrentQ(currentQ + 1);
    } else {
      setFinished(true);
    }
  };

  if (!session) {
    return (
      <SidebarLayout>
        <div className="text-center mt-20">
          <button onClick={startExam} className="btn-primary text-xl px-8 py-4">Start Exam</button>
        </div>
      </SidebarLayout>
    );
  }

  if (finished) {
    const correct = session.questions.filter((q: any) => answers[q.id] === q.correct).length;
    return (
      <SidebarLayout>
        <div className="card max-w-md mx-auto text-center">
          <h2 className="text-2xl font-bold text-blue-900 mb-4">Exam Complete</h2>
          <p className="text-4xl font-bold text-purple-600">{correct}/{session.questions.length}</p>
        </div>
      </SidebarLayout>
    );
  }

  const q = session.questions[currentQ];
  return (
    <SidebarLayout>
      <div className="card max-w-2xl mx-auto">
        <h2 className="text-lg font-semibold text-blue-900 mb-4">Question {currentQ+1} of {session.questions.length}</h2>
        <p className="text-xl mb-6">{q.text}</p>
        <div className="space-y-3">
          {q.options.map((opt: string, idx: number) => (
            <button key={idx} onClick={() => answer(String(idx))}
              className="block w-full text-left p-4 border border-gray-200 rounded-xl hover:bg-blue-50 transition">
              {opt}
            </button>
          ))}
        </div>
      </div>
    </SidebarLayout>
  );
}

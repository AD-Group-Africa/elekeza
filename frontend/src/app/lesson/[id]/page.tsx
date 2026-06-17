'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const [lesson, setLesson] = useState<any>(null);

  useEffect(() => {
    api.get(`/api/content/lessons/${id}`)
      .then((res) => setLesson(res.data))
      .catch(() => setLesson(null));
  }, [id]);

  if (!lesson) return <div className="p-6">Loading lesson...</div>;

  return (
    <main className="min-h-screen bg-white p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-blue-900 mb-6">{lesson.title}</h1>
      {lesson.simplifiedLesson?.sections?.map((section: any, i: number) => (
        <div key={i} className="bg-blue-50 rounded-2xl p-6 shadow mb-6">
          <h2 className="text-xl font-semibold text-blue-900 mb-2">{section.heading}</h2>
          <p className="text-lg leading-relaxed text-gray-800">{section.body}</p>
          <button
            onClick={() => {
              const utterance = new SpeechSynthesisUtterance(section.body);
              utterance.rate = 0.85;
              speechSynthesis.speak(utterance);
            }}
            className="mt-4 text-indigo-500 underline font-medium"
          >
            🔊 Listen
          </button>
        </div>
      ))}
    </main>
  );
}

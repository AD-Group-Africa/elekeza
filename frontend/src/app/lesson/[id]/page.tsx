'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.get(`/content/lessons/${id}`)
      .then(res => setLesson(res.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to load lesson'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <SidebarLayout><div className="text-white text-center mt-20">Loading lesson...
        <div className="mt-8 text-center">
          <button
            onClick={() => window.location.href = `/quiz/${id}`}
            className="btn-primary px-8 py-3"
          >
            Take Quiz
          </button>
        </div>
</div></SidebarLayout>;
  if (error) return <SidebarLayout><div className="card text-center mt-20 text-red-600">{error}
        <div className="mt-8 text-center">
          <button
            onClick={() => window.location.href = `/quiz/${id}`}
            className="btn-primary px-8 py-3"
          >
            Take Quiz
          </button>
        </div>
</div></SidebarLayout>;
  if (!lesson) return <SidebarLayout><div className="card text-center mt-20">Lesson not found.
        <div className="mt-8 text-center">
          <button
            onClick={() => window.location.href = `/quiz/${id}`}
            className="btn-primary px-8 py-3"
          >
            Take Quiz
          </button>
        </div>
</div></SidebarLayout>;

  return (
    <SidebarLayout>
      <h1 className="text-3xl font-bold text-white mb-8">{lesson.title}</h1>
      <div className="space-y-6">
        {lesson.sections?.map((section: any, idx: number) => (
          <div key={idx} className="card">
            <h2 className="text-xl font-semibold text-blue-900 mb-3">{section.heading}</h2>
            <p className="text-lg leading-relaxed text-gray-800">{section.body}</p>
            <button
              onClick={() => {
                const utterance = new SpeechSynthesisUtterance(section.body);
                utterance.rate = 0.85;
                speechSynthesis.speak(utterance);
              }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 border border-purple-500 text-purple-600 rounded-full hover:bg-purple-50 transition"
            >
              <span>🔊</span> Listen
            </button>
          </div>
        ))}
        <div className="mt-8 text-center">
          <button
            onClick={() => window.location.href = `/quiz/${id}`}
            className="btn-primary px-8 py-3"
          >
            Take Quiz
          </button>
        </div>

      </div>
    </SidebarLayout>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import LessonLoading from '@/components/ui/LessonLoading';
import SidebarLayout from '@/components/layout/SidebarLayout';

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setLesson({
        title: 'The Water Cycle',
        sections: [
          { heading: 'What is the Water Cycle?', body: 'Water moves around the Earth...' },
          { heading: 'Evaporation', body: 'The sun heats water...' },
        ],
      });
      setLoading(false);
    }, 2000);
  }, [id]);

  if (loading) return <LessonLoading />;

  return (
    <SidebarLayout>
      <h1 className="text-3xl font-bold text-blue-900 mb-6">{lesson?.title}</h1>
      {lesson?.sections?.map((s: any, i: number) => (
        <div key={i} className="bg-blue-50 rounded-2xl p-6 shadow mb-6">
          <h2 className="text-xl font-semibold text-blue-900 mb-2">{s.heading}</h2>
          <p className="text-lg leading-relaxed text-gray-800">{s.body}</p>
          <button
            onClick={() => speechSynthesis.speak(new SpeechSynthesisUtterance(s.body))}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 border border-purple-500 text-purple-600 rounded-full hover:bg-purple-50 transition"
          >
            <span className="text-lg">🔊</span>
            <span className="font-medium">Listen</span>
          </button>
        </div>
      ))}
      <div className="flex justify-between mt-8">
        <button className="btn-outline">← Previous Section</button>
        <button className="btn-primary">Next Section →</button>
      </div>
    </SidebarLayout>
  );
}

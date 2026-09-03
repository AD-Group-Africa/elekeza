'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { ArrowLeft, BookOpen, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

interface LessonSection {
  heading?: string;
  body: string | { text?: string; content?: string };
}

interface LessonData {
  title?: string;
  status?: string;
  sections?: LessonSection[];
  keyTerms?: Record<string, string>;
}

export default function LessonPage() {
  const { id } = useParams();
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';

  useEffect(() => {
    api.get('/content/lessons/' + id)
      .then(res => setLesson(res.data))
      .catch(() => setError('Failed to load lesson.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <SidebarLayout><div className="p-6 text-purple-200">Loading lesson…</div></SidebarLayout>;
  if (error) return <SidebarLayout><div className="p-6 text-red-400">{error}</div></SidebarLayout>;

  const title = lesson?.title || 'Untitled Lesson';
  const status = lesson?.status || '';
  const sections = lesson?.sections || [];
  const keyTerms = lesson?.keyTerms || {};

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <Link href={isStudent ? "/student-home" : "/teacher"} className="flex items-center gap-2 text-purple-300 hover:text-white">
          <ArrowLeft size={18} /> Back
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-purple-200">{title}</h1>
          {status && (
            <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium bg-green-600/40 text-green-300">{status}</span>
          )}
        </div>

        {sections.length > 0 ? (
          <div className="space-y-4">
            {sections.map((section: LessonSection, idx: number) => {
              const bodyText = typeof section.body === 'object' ? (section.body.text || section.body.content || '') : section.body;
              return (
                <div key={idx} className="glass-card p-4">
                  {section.heading && <h3 className="text-lg font-semibold text-purple-200 mb-2">{section.heading}</h3>}
                  <p className="text-purple-300 whitespace-pre-line">{bodyText}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-card p-6 text-center text-purple-300">
            <BookOpen size={48} className="text-purple-400 mx-auto mb-4" />
            <p>No content sections available yet.</p>
          </div>
        )}

        {Object.keys(keyTerms).length > 0 && (
          <div className="glass-card p-4">
            <h3 className="text-lg font-semibold text-purple-200 mb-2">Key Terms</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(keyTerms).map(([term, definition]) => (
                <span key={term} className="px-3 py-1 bg-purple-600/30 rounded-full text-sm text-purple-200" title={definition}>{term}</span>
              ))}
            </div>
          </div>
        )}

        {isStudent && (
          <div className="flex justify-end">
            <Link href={'/quiz/' + id} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg">
              Take Quiz
            </Link>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
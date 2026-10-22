'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Upload, BookOpen, Eye } from 'lucide-react';
import api from '@/lib/axios';

/** Row from GET /api/content/list. */
interface Lesson {
  id: number;
  title: string;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  READY: 'Ready',
  PROCESSING: 'Processing',
  UPLOADING: 'Processing',
  FAILED: 'Failed',
};

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const fetchLessons = useCallback(async () => {
    try {
      const res = await api.get<Lesson[]>('/content/list');
      setLessons(res.data);
    } catch {
      setMessage({ tone: 'error', text: 'Could not load your lessons. Please refresh to try again.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLessons();
  }, [fetchLessons]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/content/upload/file', formData);
      setMessage({ tone: 'ok', text: res.data?.message || `"${file.name}" uploaded.` });
      setFile(null);
      await fetchLessons();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage({ tone: 'error', text: msg || 'Upload failed. Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-2xl font-bold text-purple-200">Lessons</h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="bg-purple-600 text-white px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2 focus-within:ring-2 focus-within:ring-purple-300">
            <Upload size={18} aria-hidden="true" /> {file ? file.name : 'Choose File'}
            <input type="file" accept=".pdf,.docx,.txt" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          {file && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {uploading ? 'Processing…' : 'Upload & Simplify'}
            </button>
          )}
        </div>
      </div>

      {message && (
        <p role={message.tone === 'error' ? 'alert' : 'status'} className={message.tone === 'error' ? 'text-red-300 text-sm' : 'text-green-300 text-sm'}>
          {message.text}
        </p>
      )}

      <div className="glass-card p-4">
        {loading ? (
          <p className="text-purple-300" role="status">Loading lessons…</p>
        ) : lessons.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen size={48} className="text-purple-400 mx-auto mb-4" aria-hidden="true" />
            <p className="text-purple-200">No lessons created yet.</p>
            <p className="text-purple-300 text-sm mt-1">Upload a PDF, DOCX, or TXT file to generate your first lesson.</p>
            <Link href="/teacher/content" className="mt-3 inline-block bg-purple-600 text-white px-4 py-2 rounded-lg">Create a lesson</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {lessons.map(lesson => (
              <li key={lesson.id} className="bg-white/5 p-4 rounded-lg flex justify-between items-center gap-3">
                <div>
                  <h3 className="text-purple-200 font-semibold">{lesson.title}</h3>
                  <p className="text-purple-300 text-sm">{STATUS_LABEL[lesson.status] ?? lesson.status}</p>
                </div>
                <Link href={'/lesson/' + lesson.id} className="text-purple-300 hover:text-white flex items-center gap-1">
                  <Eye size={18} aria-hidden="true" /> View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

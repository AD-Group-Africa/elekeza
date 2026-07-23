'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import { Upload, BookOpen, Eye } from 'lucide-react';
import Link from 'next/link';

interface Lesson {
  id: number;
  title: string;
  subject: string;
  grade: string;
  created: string;
}

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchLessons = async () => {
    try {
      const res = await api.get('/content/list');
      setLessons(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLessons();
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post('/content/upload/file', formData);
      fetchLessons();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-purple-200">Lessons</h1>
        <div className="flex gap-2">
          <label className="bg-purple-600 text-white px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2">
            <Upload size={18} /> Choose File
            <input type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          {file && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg"
            >
              {uploading ? 'Processing…' : 'Upload & Simplify'}
            </button>
          )}
        </div>
      </div>

      <div className="glass-card p-4">
        {loading ? (
          <p className="text-purple-300">Loading lessons…</p>
        ) : lessons.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen size={48} className="text-purple-400 mx-auto mb-4" />
            <p className="text-purple-200">No lessons created yet.</p>
            <p className="text-purple-300 text-sm">Upload a PDF, DOCX, or TXT file to generate your first lesson.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lessons.map(lesson => (
              <div key={lesson.id} className="bg-white/5 p-4 rounded-lg flex justify-between items-center">
                <div>
                  <h3 className="text-purple-200 font-semibold">{lesson.title}</h3>
                  <p className="text-purple-300 text-sm">{lesson.subject} • {lesson.grade}</p>
                  <p className="text-purple-400 text-xs">Created: {lesson.created}</p>
                </div>
                <Link href={'/lesson/' + lesson.id} className="text-purple-300 hover:text-white flex items-center gap-1">
                  <Eye size={18} /> View
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
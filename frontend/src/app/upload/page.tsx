'use client';

import { useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function UploadPage() {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text && !file) return;

    setLoading(true);
    try {
      let lessonId: number | null = null;

      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        if (title) formData.append('title', title);
        const res = await api.post('/content/upload/file', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        lessonId = res.data.lessonId;
      } else if (text.trim()) {
        const res = await api.post('/content/upload/text', {
          text: text.trim(),
          title: title || undefined,
        });
        lessonId = res.data.lessonId;
      }

      if (lessonId) {
        router.push(`/lesson/${lessonId}`);
      }
    } catch (err: any) {
      alert('Upload failed. Ensure you are logged in and the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Upload Content</h1>
      </div>

      <form onSubmit={handleUpload} className="card max-w-2xl space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Lesson Title (optional)</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            placeholder="e.g., The Water Cycle"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Upload a document</label>
          <input
            type="file"
            accept=".txt,.pdf,.docx"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
          />
          <p className="text-xs text-gray-400 mt-1">Supported: TXT, PDF, DOCX</p>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">or</span>
          <hr className="flex-1" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Paste text content</label>
          <textarea
            rows={8}
            value={text}
            onChange={e => setText(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            placeholder="Paste your lesson text here..."
            disabled={!!file}
          />
        </div>

        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">
            {file ? file.name : text ? `${text.length} characters` : 'Choose a file or paste text'}
          </p>
          <button
            type="submit"
            disabled={(!text && !file) || loading}
            className="btn-primary disabled:opacity-50"
          >
            {loading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </form>
    </SidebarLayout>
  );
}


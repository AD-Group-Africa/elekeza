'use client';

import { useState } from 'react';
import api from '@/lib/axios';
import { Upload, FileText, Send } from 'lucide-react';

export default function ContentPage() {
  const [file, setFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState('');
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !textContent.trim()) return;

    setUploading(true);
    try {
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('topic', topic);
        formData.append('subject', subject);
        await api.post('/content/upload/file', formData);
      } else {
        await api.post('/content/upload/text', { text: textContent, topic, subject });
      }
      setMessage('Content uploaded and simplified successfully.');
      setFile(null);
      setTextContent('');
      setTopic('');
      setSubject('');
    } catch (err) {
      setMessage('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-purple-200">Content & Materials</h1>

      <div className="glass-card p-6">
        <h2 className="text-xl font-semibold text-purple-200 mb-4">Upload Lesson Material</h2>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-purple-300 mb-1">Topic / Title</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g., Fractions"
              />
            </div>
            <div>
              <label className="block text-sm text-purple-300 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Mathematics"
              />
            </div>
          </div>

          <div className="border-2 border-dashed border-purple-300/30 rounded-lg p-8 text-center">
            <Upload size={40} className="text-purple-300 mx-auto mb-3" />
            <p className="text-purple-200 mb-2">Upload a file (PDF, DOCX, TXT, image)</p>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.doc,image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-purple-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-700"
            />
            {file && (
              <div className="flex items-center gap-2 mt-2 text-purple-200">
                <FileText size={18} />
                <span>{file.name}</span>
              </div>
            )}
          </div>

          <div className="relative">
            <p className="text-sm text-purple-300 mb-2">Or paste text directly:</p>
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={6}
              className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Paste lesson content here..."
            />
          </div>

          <button
            type="submit"
            disabled={uploading || (!file && !textContent.trim())}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg disabled:opacity-50"
          >
            {uploading ? 'Processing…' : 'Upload & Simplify'}
          </button>
          {message && <p className="text-purple-300 text-sm">{message}</p>}
        </form>
      </div>
    </div>
  );
}
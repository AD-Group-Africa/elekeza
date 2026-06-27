'use client';

import { useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { useRouter } from 'next/navigation';

export default function UploadPage() {
  const [text, setText] = useState('');
  const [processing, setProcessing] = useState(false);
  const router = useRouter();

  const handleUpload = async () => {
    setProcessing(true);
    // Simulate AI processing
    setTimeout(() => {
      setProcessing(false);
      router.push('/lesson/1');
    }, 3000);
  };

  return (
    <SidebarLayout
      rightPanel={
        <div className="text-white">
          <h3 className="font-semibold mb-2">Tips for Better Results</h3>
          <ul className="list-disc pl-4 text-sm space-y-2 opacity-80">
            <li>Use clear, simple sentences.</li>
            <li>Break long paragraphs into smaller ones.</li>
            <li>Avoid slang or complex jargon.</li>
          </ul>
          <h3 className="font-semibold mt-6 mb-2">What Happens Next</h3>
          <p className="text-sm opacity-80">
            Our AI will simplify the text, verify the facts, and extract key concepts for your learners.
          </p>
        </div>
      }
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Upload Text Content</h1>
      </div>

      {processing ? (
        /* Skeleton loader */
        <div className="card bg-white rounded-2xl p-6 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-32 bg-gray-100 rounded-lg"></div>
        </div>
      ) : (
        <div className="card bg-white rounded-2xl p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject (optional)</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="e.g., Science, History"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content Text</label>
            <textarea
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="Paste your lesson text here..."
            />
          </div>

          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-500">
              {text.length} characters | {text.split(/\s+/).filter(Boolean).length} words
            </div>
            <button
              disabled={text.trim().length === 0}
              onClick={handleUpload}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Upload and Process
            </button>
          </div>
          {text.trim().length === 0 && (
            <p className="text-xs text-gray-400 mt-2">Paste text content to enable processing.</p>
          )}
        </div>
      )}
    </SidebarLayout>
  );
}

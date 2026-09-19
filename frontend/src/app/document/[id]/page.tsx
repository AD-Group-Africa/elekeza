'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import Toast from '@/components/Toast';
import { FileText } from 'lucide-react';

interface DocumentData {
  title?: string;
  contentText?: string;
}

export default function DocumentPage() {
  const { id } = useParams();
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  useEffect(() => {
    api.get('/content/lessons/' + id)
      .then(res => setDocument(res.data))
      .catch(() => setToast('Failed to load document.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSimplify = () => {
    if (!document?.contentText) {
      setToast('No text to simplify.');
      return;
    }
    // AI simplification logic would go here
    setToast('Simplification requested.');
  };

  const handleExtractTerms = () => {
    if (!document?.contentText) {
      setToast('No text to extract terms from.');
      return;
    }
    setToast('Key term extraction requested.');
  };

  if (loading) return <SidebarLayout><div className="p-6 text-purple-200">Loading…</div></SidebarLayout>;
  if (!document) return <SidebarLayout><div className="p-6 text-red-400">Document not found.</div></SidebarLayout>;

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-purple-200">{document.title || 'Untitled Document'}</h1>
        <div className="glass-card p-4">
          <pre className="text-purple-300 whitespace-pre-wrap">{document.contentText}</pre>
        </div>
        <div className="flex gap-4">
          <button onClick={handleSimplify} className="bg-purple-600 text-white px-4 py-2 rounded-lg">Simplify</button>
          <button onClick={handleExtractTerms} className="bg-purple-600 text-white px-4 py-2 rounded-lg">Extract Key Terms</button>
        </div>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </SidebarLayout>
  );
}
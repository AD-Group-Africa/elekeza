'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { FileText, Download } from 'lucide-react';

export default function GuardianReports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/guardian/reports')
      .then(res => setReports(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-purple-200">Reports</h1>
      {loading ? (
        <p className="text-purple-300">Loading…</p>
      ) : reports.length === 0 ? (
        <div className="glass-card p-6 text-center">
          <FileText size={48} className="text-purple-400 mx-auto mb-4" />
          <p className="text-purple-200">No reports available yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="glass-card p-4 flex justify-between items-center">
              <div>
                <h3 className="text-purple-200 font-semibold">{r.title}</h3>
                <p className="text-purple-300 text-sm">{r.date}</p>
              </div>
              <button className="text-purple-300 hover:text-white flex items-center gap-1">
                <Download size={18} /> Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';

export default function SchoolImport() {
  const [institutionId, setInstitutionId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-fetch institution ID from logged-in user (if SCHOOL_ADMIN)
  useEffect(() => {
    api.get('/auth/me').then(res => {
      if (res.data.institutionId) setInstitutionId(res.data.institutionId.toString());
    }).catch(() => {});
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !institutionId) return;
    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post(`/institutions/${institutionId}/students/import`, formData);
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Import Students (CSV)</h1>
        {error && <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">{error}</div>}
        <form onSubmit={handleUpload} className="card space-y-4">
          <input type="number" placeholder="Institution ID" value={institutionId}
            onChange={e => setInstitutionId(e.target.value)} className="w-full border rounded-lg p-3" required />
          <input type="file" accept=".csv" onChange={e => setFile(e.target.files?.[0] || null)}
            className="w-full border rounded-lg p-3" required />
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Importing...' : 'Upload CSV'}
          </button>
        </form>
        {result && (
          <div className="card mt-6">
            <h3 className="text-xl font-semibold mb-2">Import Result</h3>
            <p className="text-green-600">Succeeded: {result.succeeded} / {result.total}</p>
            {result.failed > 0 && <p className="text-red-600">Failed: {result.failed}</p>}
            {result.rows && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr><th>Row</th><th>Email</th><th>Password</th><th>Status</th></tr></thead>
                  <tbody>
                    {result.rows.map((row: any, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{row.row}</td>
                        <td className="p-2">{row.email}</td>
                        <td className="p-2">{row.password}</td>
                        <td className="p-2">{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}

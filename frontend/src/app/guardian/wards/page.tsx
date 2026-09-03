'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { User } from 'lucide-react';
import Link from 'next/link';

interface WardRow {
  id: number;
  name: string;
  progress?: number;
}

export default function GuardianWards() {
  const [children, setChildren] = useState<WardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/guardian/wards')
      .then(res => setChildren(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-purple-200">My Children</h1>
      {loading ? (
        <p className="text-purple-300">Loading…</p>
      ) : children.length === 0 ? (
        <div className="glass-card p-6 text-center">
          <User size={48} className="text-purple-400 mx-auto mb-4" />
          <p className="text-purple-200">No linked children yet.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {children.map(child => (
            <Link key={child.id} href={'/guardian/wards/' + child.id}>
              <div className="glass-card p-4 hover:bg-white/5 transition">
                <div className="flex items-center gap-3">
                  <User size={24} className="text-blue-400" />
                  <div>
                    <h3 className="text-lg font-semibold text-purple-200">{child.name}</h3>
                    <p className="text-purple-300 text-sm">Progress: {child.progress || 0}%</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
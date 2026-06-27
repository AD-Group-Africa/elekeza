'use client';

import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';

export default function GovernmentPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get('/api/government/stats')
      .then(res => setData(res.data))
      .catch(() => {});
  }, []);

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Government Dashboard</h1>
      </div>
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="card text-center"><p className="text-2xl font-bold text-purple-600">{data.schools}</p><p className="text-gray-500">Schools</p></div>
          <div className="card text-center"><p className="text-2xl font-bold text-purple-600">{data.learners}</p><p className="text-gray-500">Learners</p></div>
          <div className="card text-center"><p className="text-2xl font-bold text-purple-600">{data.averageLiteracy}%</p><p className="text-gray-500">Avg Literacy</p></div>
          <div className="card text-center"><p className="text-2xl font-bold text-purple-600">{data.county}</p><p className="text-gray-500">County</p></div>
        </div>
      )}
    </SidebarLayout>
  );
}

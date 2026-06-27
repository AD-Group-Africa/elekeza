'use client';

import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';

export default function AdminPage() {
  const [inst, setInst] = useState<any>(null);

  useEffect(() => {
    api.get('/api/admin/institution')
      .then(res => setInst(res.data))
      .catch(() => {});
  }, []);

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
      </div>
      {inst && (
        <div className="card max-w-md">
          <h2 className="text-xl font-semibold text-blue-900">{inst.name}</h2>
          <p className="text-gray-600 mt-2">Students: {inst.students}</p>
          <p className="text-gray-600">Teachers: {inst.teachers}</p>
        </div>
      )}
    </SidebarLayout>
  );
}

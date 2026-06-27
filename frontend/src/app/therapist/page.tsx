'use client';

import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';

export default function TherapistPage() {
  const [patients, setPatients] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/therapist/patients')
      .then(res => setPatients(res.data))
      .catch(() => {});
  }, []);

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Therapist Portal</h1>
      </div>
      <div className="space-y-4">
        {patients.map(p => (
          <div key={p.id} className="card">
            <h2 className="font-semibold text-blue-900">{p.name}</h2>
            <p className="text-gray-600">{p.notes}</p>
          </div>
        ))}
      </div>
    </SidebarLayout>
  );
}

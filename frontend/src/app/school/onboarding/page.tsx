'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';

export default function SchoolOnboarding() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    type: 'SCHOOL',
    subCounty: '',
    county: '',
    adminEmail: '',
    adminFirstName: '',
    adminLastName: '',
    contactPhone: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/institutions/register', form);
      alert('School registered! Institution ID: ' + res.data.id);
      router.push('/school/import');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Register Your School</h1>
        {error && <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="card space-y-4">
          <input className="w-full border rounded-lg p-3" placeholder="School Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          <div className="grid grid-cols-2 gap-4">
            <input className="border rounded-lg p-3" placeholder="Sub-County" value={form.subCounty} onChange={e => setForm({...form, subCounty: e.target.value})} />
            <input className="border rounded-lg p-3" placeholder="County" value={form.county} onChange={e => setForm({...form, county: e.target.value})} />
          </div>
          <input className="w-full border rounded-lg p-3" type="email" placeholder="Admin Email" value={form.adminEmail} onChange={e => setForm({...form, adminEmail: e.target.value})} required />
          <div className="grid grid-cols-2 gap-4">
            <input className="border rounded-lg p-3" placeholder="Admin First Name" value={form.adminFirstName} onChange={e => setForm({...form, adminFirstName: e.target.value})} required />
            <input className="border rounded-lg p-3" placeholder="Admin Last Name" value={form.adminLastName} onChange={e => setForm({...form, adminLastName: e.target.value})} required />
          </div>
          <input className="w-full border rounded-lg p-3" placeholder="Contact Phone" value={form.contactPhone} onChange={e => setForm({...form, contactPhone: e.target.value})} />
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Registering...' : 'Register School'}
          </button>
        </form>
      </div>
    </SidebarLayout>
  );
}

'use client';
import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';
import { Users, School, TrendingUp } from 'lucide-react';

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.get('/analytics/admin/overview')
      .then(res => setStats(res.data))
      .catch(() => {});
  }, []);

  if (!stats) return <SidebarLayout><div className="p-6">Loading...</div></SidebarLayout>;

  return (
    <SidebarLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Platform Overview</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <Users className="text-purple-400" size={24} />
              <span className="text-purple-300">Total Users</span>
            </div>
            <p className="text-4xl font-extrabold text-white">{stats.totalUsers}</p>
          </div>
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <School className="text-purple-400" size={24} />
              <span className="text-purple-300">Institutions</span>
            </div>
            <p className="text-4xl font-extrabold text-white">{stats.institutions}</p>
          </div>
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="text-purple-400" size={24} />
              <span className="text-purple-300">Teachers / Students</span>
            </div>
            <p className="text-4xl font-extrabold text-white">{stats.teachers} / {stats.students}</p>
          </div>
        </div>
        <div className="glass-card p-6 mt-6">
          <h2 className="text-xl font-semibold text-purple-300 mb-4">Distribution</h2>
          <div className="space-y-2 text-white">
            <p>Teachers: {stats.teachers}</p>
            <p>Students: {stats.students}</p>
            <p>Guardians: {stats.guardians}</p>
            <p>Institutions: {stats.institutions}</p>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}


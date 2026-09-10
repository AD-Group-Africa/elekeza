'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { Building2, Users, GraduationCap, Search, Bell } from 'lucide-react';

interface AdminOverview {
  institutions?: number;
  totalUsers?: number;
  students?: number;
}

interface SchoolRow {
  id: number;
  name: string;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<AdminOverview | null>(null);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [selectedSchool, setSelectedSchool] = useState('all');
  const [notifications, setNotifications] = useState<Array<{ id: number; title?: string; message?: string; createdAt?: string }>>([]);

  useEffect(() => {
    api.get('/analytics/admin/overview').then(res => setStats(res.data)).catch(() => {});
    // Fetch schools list (assuming endpoint exists; otherwise use mock)
    api.get('/institutions').then(res => setSchools(res.data || [])).catch(() => {});
    api.get('/notifications').then(res => setNotifications(res.data || [])).catch(() => {});
  }, []);

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold text-purple-200">Platform Administration</h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="glass-card p-4 flex flex-col items-center">
            <Building2 size={24} className="text-blue-400 mb-2" />
            <p className="text-purple-300 text-sm">Total Schools</p>
            <p className="text-2xl font-bold text-purple-100">{stats?.institutions ?? '—'}</p>
          </div>
          <div className="glass-card p-4 flex flex-col items-center">
            <Users size={24} className="text-green-400 mb-2" />
            <p className="text-purple-300 text-sm">Total Users</p>
            <p className="text-2xl font-bold text-purple-100">{stats?.totalUsers || 0}</p>
          </div>
          <div className="glass-card p-4 flex flex-col items-center">
            <GraduationCap size={24} className="text-purple-400 mb-2" />
            <p className="text-purple-300 text-sm">Enrolled Learners</p>
            <p className="text-2xl font-bold text-purple-100">{stats?.students || 0}</p>
          </div>
          <div className="glass-card p-4 flex flex-col items-center">
            <Search size={24} className="text-yellow-400 mb-2" />
            <p className="text-purple-300 text-sm">Pending Approvals</p>
            <p className="text-2xl font-bold text-purple-100">0</p>
          </div>
        </div>

        <div className="glass-card p-4">
          <h2 className="text-lg font-semibold text-purple-200 mb-3">Select School</h2>
          <select aria-label="Select school" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white" value={selectedSchool} onChange={e => setSelectedSchool(e.target.value)}>
            <option value="all" className="bg-gray-800">All Schools</option>
            {schools.map((s: SchoolRow) => (
              <option key={s.id} value={s.id} className="bg-gray-800">{s.name}</option>
            ))}
          </select>
        </div>

        <div className="glass-card p-4">
          <h2 className="text-lg font-semibold text-purple-200 mb-3 flex items-center gap-2"><Bell size={18} /> Notifications</h2>
          {notifications.length === 0 ? (
            <p className="text-purple-300">No notifications yet.</p>
          ) : (
            <div className="space-y-2 text-purple-300">
              {notifications.slice(0, 8).map(n => (
                <p key={n.id} className="truncate">• {n.title || n.message || 'Notification'}</p>
              ))
              }
            </div>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
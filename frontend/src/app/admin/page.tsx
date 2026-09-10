'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import Toast from '@/components/Toast';
import { Users, BookOpen, GraduationCap, Plus, Upload } from 'lucide-react';
import Link from 'next/link';

interface AdminStats {
  totalTeachers?: number;
  totalLearners?: number;
  totalContent?: number;
}

interface StudentRow {
  id: number;
  name: string;
  grade?: string;
}

export default function SchoolAdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({});
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [grouped, setGrouped] = useState<Record<string, StudentRow[]>>({});
  const [toast, setToast] = useState('');

  useEffect(() => {
    api.get('/analytics/admin').then(res => setStats(res.data)).catch(() => {});
    api.get('/teacher/students').then(res => {
      setStudents(res.data);
      const grp: Record<string, StudentRow[]> = {};
      res.data.forEach((s: StudentRow) => {
        const grade = s.grade || 'Unassigned';
        if (!grp[grade]) grp[grade] = [];
        grp[grade].push(s);
      });
      setGrouped(grp);
    }).catch(console.error);
  }, []);

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-purple-200">School Administration</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPI icon={<Users size={24} className="text-blue-400 mb-2" />} label="Teachers" value={stats?.totalTeachers || 0} />
          <KPI icon={<GraduationCap size={24} className="text-green-400 mb-2" />} label="Students" value={stats?.totalLearners || 0} />
          <KPI icon={<BookOpen size={24} className="text-purple-400 mb-2" />} label="Lessons" value={stats?.totalContent || 0} />
          <KPI icon={<Upload size={24} className="text-yellow-400 mb-2" />} label="Imports" value="0" />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="glass-card p-4">
            <h2 className="text-lg font-semibold text-purple-200 mb-3">Students by Grade</h2>
            {Object.keys(grouped).length === 0 ? <p className="text-purple-300">No students enrolled.</p> :
              Object.entries(grouped).map(([grade, studs]) => (
                <div key={grade} className="mb-2">
                  <h3 className="text-purple-200 font-medium">{grade} ({studs.length})</h3>
                  <ul className="text-purple-300 text-sm ml-4">
                    {studs.slice(0, 5).map(s => <li key={s.id}>{s.name}</li>)}
                    {studs.length > 5 && <li>...and {studs.length - 5} more</li>}
                  </ul>
                </div>
              ))}
          </div>
          <div className="glass-card p-4">
            <h2 className="text-lg font-semibold text-purple-200 mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/teacher/students" className="bg-purple-600/40 text-white p-3 rounded-lg text-center">Add Student</Link>
              <Link href="/school/import" className="bg-purple-600/40 text-white p-3 rounded-lg text-center">Import CSV</Link>
              <button onClick={() => setToast('Reports module coming soon')} className="bg-purple-600/40 text-white p-3 rounded-lg">Reports</button>
            </div>
          </div>
        </div>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </SidebarLayout>
  );
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="glass-card p-4 flex flex-col items-center">
      {icon}
      <p className="text-purple-300 text-sm">{label}</p>
      <p className="text-2xl font-bold text-purple-100">{value}</p>
    </div>
  );
}
'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { User, Mail, Shield, BookOpen, Clock, Settings, Activity } from 'lucide-react';
import Link from 'next/link';

interface ProfileData {
  name: string;
  email: string;
  role: string;
  learnerId?: string | number;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me')
      .then(res => setProfile(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SidebarLayout><div className="p-6 text-purple-200">Loading profile…</div></SidebarLayout>;
  if (!profile) return <SidebarLayout><div className="p-6 text-red-400">Failed to load profile.</div></SidebarLayout>;

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-purple-600 flex items-center justify-center text-2xl font-bold text-white">
            {(profile.name || 'U')[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-purple-200">{profile.name}</h1>
            <p className="text-purple-300 text-sm">{profile.role}</p>
          </div>
        </div>

        <div className="glass-card p-4">
          <h2 className="text-lg font-semibold text-purple-200 mb-3">Account Details</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-purple-200">
              <User size={18} className="text-blue-400" />
              <span className="text-purple-300">Name:</span>
              <span>{profile.name}</span>
            </div>
            <div className="flex items-center gap-2 text-purple-200">
              <Mail size={18} className="text-green-400" />
              <span className="text-purple-300">Email:</span>
              <span>{profile.email}</span>
            </div>
            <div className="flex items-center gap-2 text-purple-200">
              <Shield size={18} className="text-yellow-400" />
              <span className="text-purple-300">Role:</span>
              <span>{profile.role}</span>
            </div>
            <div className="flex items-center gap-2 text-purple-200">
              <Clock size={18} className="text-purple-400" />
              <span className="text-purple-300">Account ID:</span>
              <span>{profile.learnerId}</span>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Link href="/dashboard/settings" className="glass-card p-4 hover:bg-white/5 transition flex items-center gap-3">
            <Settings size={24} className="text-purple-300" />
            <div>
              <h3 className="text-purple-200 font-semibold">Accessibility Settings</h3>
              <p className="text-purple-400 text-sm">Customize your learning experience</p>
            </div>
          </Link>
          <Link href="/progress" className="glass-card p-4 hover:bg-white/5 transition flex items-center gap-3">
            <Activity size={24} className="text-green-300" />
            <div>
              <h3 className="text-purple-200 font-semibold">Your Progress</h3>
              <p className="text-purple-400 text-sm">View your learning journey</p>
            </div>
          </Link>
        </div>

        <div className="glass-card p-4">
          <h2 className="text-lg font-semibold text-purple-200 mb-2">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/student-home" className="bg-white/5 p-3 rounded text-purple-200 hover:bg-white/10 transition text-center">Dashboard</Link>
            <Link href="/dashboard/settings" className="bg-white/5 p-3 rounded text-purple-200 hover:bg-white/10 transition text-center">Settings</Link>
            <button className="bg-white/5 p-3 rounded text-purple-200 hover:bg-white/10 transition">Change Password</button>
            <button className="bg-white/5 p-3 rounded text-purple-200 hover:bg-white/10 transition">Help</button>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
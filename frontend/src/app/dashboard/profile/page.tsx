'use client';

import Link from 'next/link';
import { User, Mail, Shield, Clock, Settings, Activity } from 'lucide-react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { useAuth } from '@/hooks/useAuth';
import { roleHome, roleLabel } from '@/lib/roles';

const QUICK_ACTION = 'bg-white/5 p-3 rounded text-purple-200 hover:bg-white/10 transition text-center';

export default function ProfilePage() {
  const { user: profile, loading } = useAuth();

  if (loading) return <SidebarLayout><div className="p-6 text-purple-200" role="status">Loading profile…</div></SidebarLayout>;
  if (!profile) return <SidebarLayout><div className="p-6 text-red-400" role="alert">Failed to load profile.</div></SidebarLayout>;

  const isLearner = profile.role === 'STUDENT';

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-purple-600 flex items-center justify-center text-2xl font-bold text-white" aria-hidden="true">
            {(profile.name || 'U')[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-purple-200">{profile.name}</h1>
            <p className="text-purple-300 text-sm">{roleLabel(profile.role)}</p>
          </div>
        </div>

        <div className="glass-card p-4">
          <h2 className="text-lg font-semibold text-purple-200 mb-3">Account Details</h2>
          <dl className="space-y-2">
            <div className="flex items-center gap-2 text-purple-200">
              <User size={18} className="text-blue-400" aria-hidden="true" />
              <dt className="text-purple-300">Name:</dt>
              <dd>{profile.name}</dd>
            </div>
            <div className="flex items-center gap-2 text-purple-200">
              <Mail size={18} className="text-green-400" aria-hidden="true" />
              <dt className="text-purple-300">Email:</dt>
              <dd>{profile.email}</dd>
            </div>
            <div className="flex items-center gap-2 text-purple-200">
              <Shield size={18} className="text-yellow-400" aria-hidden="true" />
              <dt className="text-purple-300">Role:</dt>
              <dd>{roleLabel(profile.role)}</dd>
            </div>
            <div className="flex items-center gap-2 text-purple-200">
              <Clock size={18} className="text-purple-400" aria-hidden="true" />
              <dt className="text-purple-300">Account ID:</dt>
              <dd>{profile.learnerId}</dd>
            </div>
          </dl>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Link href="/dashboard/settings" className="glass-card p-4 hover:bg-white/5 transition flex items-center gap-3">
            <Settings size={24} className="text-purple-300" aria-hidden="true" />
            <div>
              <h3 className="text-purple-200 font-semibold">Accessibility Settings</h3>
              <p className="text-purple-400 text-sm">Customize your learning experience</p>
            </div>
          </Link>
          {isLearner && (
            <Link href="/progress" className="glass-card p-4 hover:bg-white/5 transition flex items-center gap-3">
              <Activity size={24} className="text-green-300" aria-hidden="true" />
              <div>
                <h3 className="text-purple-200 font-semibold">Your Progress</h3>
                <p className="text-purple-400 text-sm">View your learning journey</p>
              </div>
            </Link>
          )}
        </div>

        <div className="glass-card p-4">
          <h2 className="text-lg font-semibold text-purple-200 mb-2">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            <Link href={roleHome(profile.role)} className={QUICK_ACTION}>Dashboard</Link>
            <Link href="/dashboard/settings" className={QUICK_ACTION}>Settings</Link>
            {/* Password changes go through the emailed reset link. */}
            <Link href="/forgot-password" className={QUICK_ACTION}>Change Password</Link>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('elekeza:assist-open'))}
              className={QUICK_ACTION}
            >
              Help
            </button>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}

'use client';

import { useAuth } from '@/hooks/useAuth';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Your Account Profile</h1>
      </div>
      <div className="card max-w-2xl">
        <h2 className="text-xl font-semibold text-blue-900 mb-4">Account Details</h2>
        <div className="space-y-2">
          <p className="text-gray-700"><span className="font-medium">Name:</span> {user?.name || 'Not set'}</p>
          <p className="text-gray-700"><span className="font-medium">Email:</span> {user?.email}</p>
          <p className="text-gray-700"><span className="font-medium">Role:</span> {user?.role || 'Student'}</p>
        </div>
        <div className="mt-6 border-t pt-4 flex flex-wrap gap-3">
          <button onClick={() => router.push('/upload')} className="btn-primary">Upload Learning Content</button>
          <button onClick={() => router.push('/dashboard/history')} className="btn-outline">View History</button>
          <button onClick={() => router.push('/dashboard/settings')} className="btn-outline">Open Settings</button>
        </div>
      </div>
    </SidebarLayout>
  );
}


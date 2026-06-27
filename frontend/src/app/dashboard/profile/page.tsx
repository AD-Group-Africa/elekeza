'use client';

import { useAuth } from '@/hooks/useAuth';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { useState } from 'react';

export default function ProfilePage() {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');

  const handleSave = () => {
    // Save to backend or localStorage
    setEditing(false);
  };

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Your Account Profile</h1>
      </div>

      <div className="card bg-white rounded-2xl p-6 max-w-2xl">
        <h2 className="text-xl font-semibold text-blue-900 mb-4">Account Details</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            {editing ? (
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
                <button onClick={handleSave} className="btn-primary py-2 px-4">Save</button>
                <button onClick={() => setEditing(false)} className="btn-outline py-2 px-4">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-800">{name || 'Not set'}</span>
                <button
                  onClick={() => setEditing(true)}
                  className="text-purple-600 text-sm hover:underline"
                >
                  {name ? 'Edit' : '+ Add Full Name'}
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <p className="text-gray-800 mt-1">{user?.email || 'Not set'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <p className="text-gray-800 mt-1">{user?.role || 'Student'}</p>
          </div>
        </div>

        <div className="mt-6 border-t pt-4">
          <h3 className="font-semibold text-blue-900 mb-2">Quick Actions</h3>
          <div className="flex gap-2 flex-wrap">
            <button className="btn-primary">Upload Learning Content</button>
            <button className="btn-outline">View History</button>
            <button className="btn-outline">Open Settings</button>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}

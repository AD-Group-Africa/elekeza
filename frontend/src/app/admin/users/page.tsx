'use client'

import RoleLayout from '@/components/roles/RoleLayout'
import { adminConfig } from '@/components/roles/roleConfig'
import { Panel, RoleHero } from '@/components/roles/RoleBlocks'

export default function AdminUsersPage() {
  return (
    <RoleLayout config={adminConfig}>
      <RoleHero title="User Management" description="Create, edit, and manage users across all roles." />
      <Panel title="User Controls">
        <div className="mb-3 grid gap-3 md:grid-cols-3">
          <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Search users..." />
          <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option>Role filter</option>
            <option>Student</option>
            <option>Guardian</option>
            <option>Teacher</option>
            <option>Admin</option>
          </select>
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Add User</button>
        </div>
        <p className="text-sm text-slate-700">Bulk actions: assign role, reset password, deactivate account.</p>
      </Panel>
    </RoleLayout>
  )
}


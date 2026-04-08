'use client'

import RoleLayout from '@/components/roles/RoleLayout'
import { adminConfig } from '@/components/roles/roleConfig'
import { Panel, RoleHero } from '@/components/roles/RoleBlocks'

export default function AdminSecurityPage() {
  return (
    <RoleLayout config={adminConfig}>
      <RoleHero title="Security and Permissions" description="Manage role-based permissions and review audit logs." />
      <Panel title="RBAC Controls">
        <div className="space-y-2 text-sm text-slate-700">
          <p>Student: Learning pages only, no system config access.</p>
          <p>Guardian: Student monitoring + communication + controlled settings.</p>
          <p>Teacher: Content, assignments, student monitoring, communication.</p>
          <p>Admin: Full system access with audited actions.</p>
        </div>
        <button className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Open Audit Logs</button>
      </Panel>
    </RoleLayout>
  )
}


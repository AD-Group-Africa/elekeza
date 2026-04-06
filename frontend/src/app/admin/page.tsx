'use client'

import RoleLayout from '@/components/roles/RoleLayout'
import { adminConfig } from '@/components/roles/roleConfig'
import { Panel, RoleHero, StatGrid } from '@/components/roles/RoleBlocks'

export default function AdminDashboardPage() {
  return (
    <RoleLayout config={adminConfig}>
      <RoleHero title="Admin Dashboard" description="System-wide oversight of usage, activity, and alerts." />
      <StatGrid
        stats={[
          { label: 'Total Users', value: '1,284' },
          { label: 'Active Sessions', value: '213' },
          { label: 'Open Alerts', value: '7' },
          { label: 'Institutions', value: '12' },
        ]}
      />
      <Panel title="Current Issues">
        <ul className="space-y-2 text-sm text-slate-700">
          <li>⚠ One school reports intermittent connectivity.</li>
          <li>⚠ Two guardian accounts pending verification.</li>
          <li>✔ Daily backup completed successfully.</li>
        </ul>
      </Panel>
    </RoleLayout>
  )
}


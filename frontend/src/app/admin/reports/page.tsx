'use client'

import RoleLayout from '@/components/roles/RoleLayout'
import { adminConfig } from '@/components/roles/roleConfig'
import { Panel, RoleHero, StatGrid } from '@/components/roles/RoleBlocks'

export default function AdminReportsPage() {
  return (
    <RoleLayout config={adminConfig}>
      <RoleHero title="Reports and Analytics" description="Review system-wide trends and export operational insights." />
      <StatGrid
        stats={[
          { label: 'Monthly Active Users', value: '+12%' },
          { label: 'Task Completion Growth', value: '+8%' },
          { label: 'Low Connectivity Regions', value: '3' },
          { label: 'Engagement Trend', value: 'Stable' },
        ]}
      />
      <Panel title="Reporting Actions">
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Export Full Report</button>
      </Panel>
    </RoleLayout>
  )
}


'use client'

import RoleLayout from '@/components/roles/RoleLayout'
import { guardianConfig } from '@/components/roles/roleConfig'
import { Panel, RoleHero, StatGrid } from '@/components/roles/RoleBlocks'

export default function GuardianDashboardPage() {
  return (
    <RoleLayout config={guardianConfig}>
      <RoleHero
        title="Guardian Dashboard"
        description="Overview of learner activity, performance, and support alerts in plain language."
      />

      <StatGrid
        stats={[
          { label: 'Tasks Completed Today', value: '6' },
          { label: 'Missed Tasks', value: '2' },
          { label: 'Weekly Progress', value: 'Improving' },
          { label: 'Support Alerts', value: '1' },
        ]}
      />

      <Panel title="Daily Summary">
        <ul className="space-y-2 text-sm text-slate-700">
          <li>✔ Reading task completed in 14 minutes.</li>
          <li>✔ Quiz score improved from 62% to 74%.</li>
          <li>⚠ Math review task not started yet.</li>
        </ul>
      </Panel>
    </RoleLayout>
  )
}


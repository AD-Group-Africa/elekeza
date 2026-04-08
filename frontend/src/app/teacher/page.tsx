'use client'

import RoleLayout from '@/components/roles/RoleLayout'
import { teacherConfig } from '@/components/roles/roleConfig'
import { Panel, RoleHero, StatGrid } from '@/components/roles/RoleBlocks'

export default function TeacherDashboardPage() {
  return (
    <RoleLayout config={teacherConfig}>
      <RoleHero title="Teacher Dashboard" description="Quick class overview, alerts, and intervention priorities." />
      <StatGrid
        stats={[
          { label: 'Students', value: '38' },
          { label: 'Needs Intervention', value: '5' },
          { label: 'Inactive Today', value: '3' },
          { label: 'Assignments Due', value: '12' },
        ]}
      />
      <Panel title="Priority Alerts">
        <ul className="space-y-2 text-sm text-slate-700">
          <li>⚠ 2 students have missed 3+ tasks this week.</li>
          <li>⚠ 1 learner dropped significantly in comprehension score.</li>
          <li>✔ 4 students showed strong improvement this week.</li>
        </ul>
      </Panel>
    </RoleLayout>
  )
}


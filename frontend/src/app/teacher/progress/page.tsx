'use client'

import RoleLayout from '@/components/roles/RoleLayout'
import { teacherConfig } from '@/components/roles/roleConfig'
import { Panel, RoleHero, StatGrid } from '@/components/roles/RoleBlocks'

export default function TeacherProgressPage() {
  return (
    <RoleLayout config={teacherConfig}>
      <RoleHero title="Student Progress Analytics" description="View performance trends and pinpoint challenge areas quickly." />
      <StatGrid
        stats={[
          { label: 'Average Completion', value: '79%' },
          { label: 'Average Score', value: '68%' },
          { label: 'At-Risk Students', value: '5' },
          { label: 'Improving Students', value: '14' },
        ]}
      />
      <Panel title="Problem Areas">
        <ul className="space-y-2 text-sm text-slate-700">
          <li>Reading inferencing questions have the highest error rate.</li>
          <li>Task completion drops after 4:00 PM sessions.</li>
          <li>Simplified instructions improve completion by 18%.</li>
        </ul>
      </Panel>
    </RoleLayout>
  )
}


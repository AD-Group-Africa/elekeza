'use client'

import RoleLayout from '@/components/roles/RoleLayout'
import { guardianConfig } from '@/components/roles/roleConfig'
import { Panel, RoleHero, StatGrid } from '@/components/roles/RoleBlocks'

export default function GuardianReportsPage() {
  return (
    <RoleLayout config={guardianConfig}>
      <RoleHero
        title="Progress and Reports"
        description="Track academic and behavioral trends with simple visual summaries."
      />

      <StatGrid
        stats={[
          { label: 'Literacy Trend', value: 'Improving' },
          { label: 'Task Completion', value: '82%' },
          { label: 'Attention Score', value: 'Stable' },
          { label: 'Support Needs', value: 'Needs Help in Math' },
        ]}
      />

      <Panel title="Plain-Language Insight">
        <p className="text-sm text-slate-700">
          The learner is doing better in reading comprehension this week. Math problem-solving still needs guided support.
        </p>
        <button className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Export Summary</button>
      </Panel>
    </RoleLayout>
  )
}



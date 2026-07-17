'use client'

import RoleLayout from '@/components/roles/RoleLayout'
import { guardianConfig } from '@/components/roles/roleConfig'
import { Panel, RoleHero } from '@/components/roles/RoleBlocks'

const routineItems = [
  { time: '08:00', task: 'Reading Warmup', status: 'Completed' },
  { time: '10:00', task: 'Math Practice', status: 'Pending' },
  { time: '14:00', task: 'Speech Session', status: 'Scheduled' },
  { time: '17:00', task: 'Homework Review', status: 'Pending' },
]

export default function GuardianSchedulePage() {
  return (
    <RoleLayout config={guardianConfig}>
      <RoleHero
        title="Schedule and Routine"
        description="Manage daily routine, reminders, and appointments in calendar/list style."
      />

      <Panel title="Today Routine List">
        <ul className="space-y-3">
          {routineItems.map((item) => (
            <li key={`${item.time}-${item.task}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.task}</p>
                <p className="text-xs text-slate-500">{item.time}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{item.status}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </RoleLayout>
  )
}



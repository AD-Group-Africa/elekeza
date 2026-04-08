'use client'

import RoleLayout from '@/components/roles/RoleLayout'
import { teacherConfig } from '@/components/roles/roleConfig'
import { Panel, RoleHero } from '@/components/roles/RoleBlocks'

export default function TeacherAssignmentsPage() {
  return (
    <RoleLayout config={teacherConfig}>
      <RoleHero title="Assignments and Tasks" description="Create step-by-step tasks with reminder and deadline settings." />
      <Panel title="New Task Builder">
        <input placeholder="Task title" className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <textarea className="mb-3 h-32 w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="Task instructions..." />
        <div className="grid gap-3 md:grid-cols-2">
          <input type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option>Reminder setting</option>
            <option>1 day before</option>
            <option>Same day</option>
            <option>Custom</option>
          </select>
        </div>
        <button className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Create Assignment</button>
      </Panel>
    </RoleLayout>
  )
}


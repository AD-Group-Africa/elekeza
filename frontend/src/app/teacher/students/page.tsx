'use client'

import RoleLayout from '@/components/roles/RoleLayout'
import { teacherConfig } from '@/components/roles/roleConfig'
import { Panel, RoleHero } from '@/components/roles/RoleBlocks'

const learners = [
  { name: 'Amina J', level: 'Needs support', status: 'At Risk' },
  { name: 'Brian T', level: 'On track', status: 'Stable' },
  { name: 'Clara M', level: 'Advanced', status: 'Improving' },
]

export default function TeacherStudentsPage() {
  return (
    <RoleLayout config={teacherConfig}>
      <RoleHero title="Student Management" description="Search, filter, and open student profiles quickly." />
      <Panel title="Student List">
        <div className="mb-3 grid gap-3 md:grid-cols-2">
          <input placeholder="Search student..." className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option>Filter by performance</option>
            <option>At Risk</option>
            <option>Stable</option>
            <option>Improving</option>
          </select>
        </div>
        <ul className="space-y-2">
          {learners.map((learner) => (
            <li key={learner.name} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{learner.name}</p>
                <p className="text-xs text-slate-500">{learner.level}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{learner.status}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </RoleLayout>
  )
}


'use client'

import RoleLayout from '@/components/roles/RoleLayout'
import { teacherConfig } from '@/components/roles/roleConfig'
import { Panel, RoleHero } from '@/components/roles/RoleBlocks'

export default function TeacherContentPage() {
  return (
    <RoleLayout config={teacherConfig}>
      <RoleHero title="Content and Lessons" description="Create adaptable lesson content for diverse cognitive needs." />
      <Panel title="Create Lesson Material">
        <div className="grid gap-3 md:grid-cols-2">
          <input placeholder="Lesson title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option>Difficulty level</option>
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
        </div>
        <textarea className="mt-3 h-40 w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="Lesson content..." />
        <div className="mt-3 flex gap-2">
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Upload Text</button>
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Attach Audio</button>
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Attach Image</button>
        </div>
      </Panel>
    </RoleLayout>
  )
}


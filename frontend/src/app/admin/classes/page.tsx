'use client'

import RoleLayout from '@/components/roles/RoleLayout'
import { adminConfig } from '@/components/roles/roleConfig'
import { Panel, RoleHero } from '@/components/roles/RoleBlocks'

export default function AdminClassesPage() {
  return (
    <RoleLayout config={adminConfig}>
      <RoleHero title="Institution and Class Management" description="Manage class groups and teacher-student assignment." />
      <Panel title="Class Assignment Controls">
        <div className="grid gap-3 md:grid-cols-2">
          <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option>Select class group</option>
            <option>Class 6A</option>
            <option>Class 6B</option>
          </select>
          <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option>Assign teacher</option>
            <option>Teacher N. Kamau</option>
            <option>Teacher J. Akinyi</option>
          </select>
        </div>
      </Panel>
    </RoleLayout>
  )
}


'use client'

import RoleLayout from '@/components/roles/RoleLayout'
import { guardianConfig } from '@/components/roles/roleConfig'
import { Panel, RoleHero } from '@/components/roles/RoleBlocks'

const guardianControls = [
  'Lock student settings',
  'Require confirmation before setting changes',
  'Enable parent approval for new support profiles',
]

export default function GuardianSettingsPage() {
  return (
    <RoleLayout config={guardianConfig}>
      <RoleHero
        title="Guardian Controls"
        description="Manage student support settings and lock sensitive configuration changes."
      />

      <Panel title="Control Settings">
        <div className="space-y-3">
          {guardianControls.map((control) => (
            <label key={control} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <span className="text-sm font-medium text-slate-800">{control}</span>
              <input type="checkbox" defaultChecked className="h-4 w-4" />
            </label>
          ))}
        </div>
      </Panel>
    </RoleLayout>
  )
}





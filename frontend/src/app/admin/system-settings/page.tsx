'use client'

import RoleLayout from '@/components/roles/RoleLayout'
import { adminConfig } from '@/components/roles/roleConfig'
import { Panel, RoleHero } from '@/components/roles/RoleBlocks'

export default function AdminSystemSettingsPage() {
  return (
    <RoleLayout config={adminConfig}>
      <RoleHero title="System Settings" description="Configure default accessibility, global feature toggles, and notifications." />
      <Panel title="Global Defaults">
        <div className="space-y-3">
          <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <span className="text-sm text-slate-800">Default accessibility profile enabled</span>
            <input type="checkbox" defaultChecked className="h-4 w-4" />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <span className="text-sm text-slate-800">System notifications enabled</span>
            <input type="checkbox" defaultChecked className="h-4 w-4" />
          </label>
        </div>
      </Panel>
    </RoleLayout>
  )
}


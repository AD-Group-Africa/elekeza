'use client'

import RoleLayout from '@/components/roles/RoleLayout'
import { guardianConfig } from '@/components/roles/roleConfig'
import { Panel, RoleHero } from '@/components/roles/RoleBlocks'

export default function GuardianCommunicationPage() {
  return (
    <RoleLayout config={guardianConfig}>
      <RoleHero
        title="Communication"
        description="Simple chat with teachers and school support, with clear message status."
      />

      <Panel title="Messages">
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Teacher: â€œToday your learner completed all reading tasks.â€ <span className="text-xs text-slate-500">(Read)</span>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
            You: â€œThank you, can we review math support options?â€ <span className="text-xs text-slate-500">(Delivered)</span>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">New Message</button>
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Voice Note</button>
        </div>
      </Panel>
    </RoleLayout>
  )
}



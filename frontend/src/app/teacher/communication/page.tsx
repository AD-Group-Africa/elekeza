'use client'

import RoleLayout from '@/components/roles/RoleLayout'
import { teacherConfig } from '@/components/roles/roleConfig'
import { Panel, RoleHero } from '@/components/roles/RoleBlocks'

export default function TeacherCommunicationPage() {
  return (
    <RoleLayout config={teacherConfig}>
      <RoleHero title="Communication" description="Coordinate with students and guardians through simple messaging." />
      <Panel title="Message Channels">
        <div className="space-y-2 text-sm text-slate-700">
          <p>Group: Grade 6 Guardians (8 unread)</p>
          <p>Student: Brian T (Needs follow-up)</p>
          <p>Guardian: Amina Parent (Sent update)</p>
        </div>
        <button className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Open Messages</button>
      </Panel>
    </RoleLayout>
  )
}



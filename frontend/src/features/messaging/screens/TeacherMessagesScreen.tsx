'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Reply, Send } from 'lucide-react';
import { Button, Card, Field, PageHeader, Select, Textarea, Toast } from '@/components/ui';
import { useStudents } from '@/features/teacher/api';
import { cn } from '@/lib/cn';
import { messagingApi, messagingKeys } from '../api';
import { MessageThread } from '../components/MessageThread';

/** Guardian ↔ teacher messaging (teacher side): read and reply. */
export default function TeacherMessagesScreen() {
  const queryClient = useQueryClient();
  const thread = useQuery({ queryKey: messagingKeys.teacherThread, queryFn: messagingApi.teacherMessages });
  const students = useStudents();
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [toast, setToast] = useState('');

  // Who the teacher can write to: guardians of their learners (enforced server-side too),
  // plus anyone who has written to them.
  const recipients = useMemo(() => {
    const map = new Map<number, string>();
    (thread.data ?? []).forEach((m) => {
      if (m.senderId != null) map.set(m.senderId, m.senderName || `Guardian #${m.senderId}`);
    });
    (students.data ?? []).forEach((s) => {
      if (s.guardianUserId && !map.has(s.guardianUserId)) {
        map.set(s.guardianUserId, `${s.guardianName?.trim() || `Guardian of ${s.name}`} (${s.name})`);
      }
    });
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [thread.data, students.data]);

  const send = useMutation({
    mutationFn: () => messagingApi.sendToGuardian(replyTo!, draft),
    onSuccess: async () => {
      setDraft('');
      setToast('Reply sent!');
      await queryClient.invalidateQueries({ queryKey: messagingKeys.teacherThread });
    },
    onError: () => setToast('Failed to send message.'),
  });

  const canSend = !send.isPending && draft.trim() !== '' && replyTo != null;
  const count = thread.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Communication" description={`${count} message${count === 1 ? '' : 's'}`} />

      <MessageThread
        messages={thread.data ?? []}
        loading={thread.isLoading}
        emptyText="No messages from guardians yet."
        fallbackSender="Guardian"
        renderAction={(m) =>
          m.senderId != null && (
            <button
              type="button"
              onClick={() => setReplyTo(m.senderId)}
              aria-pressed={replyTo === m.senderId}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1 text-xs',
                replyTo === m.senderId ? 'bg-purple-600 text-white' : 'bg-white/10 text-purple-200 hover:bg-white/20',
              )}
            >
              <Reply size={12} aria-hidden="true" /> {replyTo === m.senderId ? 'Replying' : 'Reply'}
            </button>
          )
        }
      />

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) send.mutate();
          }}
          className="space-y-3"
        >
          <Field id="teacher-recipient" label={replyTo ? 'Reply to guardian' : 'Choose a guardian'}>
            <Select
              id="teacher-recipient"
              value={replyTo ?? ''}
              onChange={(e) => setReplyTo(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Select a guardian…</option>
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="teacher-reply" label="Your reply" srOnlyLabel>
            <Textarea
              id="teacher-reply"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              placeholder="Type your reply…"
            />
          </Field>
          <Button
            type="submit"
            disabled={!canSend}
            loading={send.isPending}
            icon={<Send size={18} aria-hidden="true" />}
          >
            {send.isPending ? 'Sending…' : 'Send Reply'}
          </Button>
        </form>
      </Card>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}

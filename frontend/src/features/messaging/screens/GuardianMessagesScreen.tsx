'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { Button, Card, Field, PageHeader, Select, TextInput, Toast } from '@/components/ui';
import { messagingApi, messagingKeys } from '../api';
import { MessageThread } from '../components/MessageThread';

/** Guardian ↔ teacher messaging (guardian side). */
export default function GuardianMessagesScreen() {
  const queryClient = useQueryClient();
  const thread = useQuery({ queryKey: messagingKeys.guardianThread, queryFn: messagingApi.guardianMessages });
  const teachers = useQuery({ queryKey: messagingKeys.guardianTeachers, queryFn: messagingApi.guardianTeachers });
  const [chosenTeacher, setChosenTeacher] = useState<number | null>(null);
  const teacherId = chosenTeacher ?? teachers.data?.[0]?.id ?? null;
  const [draft, setDraft] = useState('');
  const [toast, setToast] = useState('');

  const send = useMutation({
    mutationFn: () => messagingApi.sendToTeacher(teacherId!, draft),
    onSuccess: async () => {
      setDraft('');
      setToast('Message sent!');
      await queryClient.invalidateQueries({ queryKey: messagingKeys.guardianThread });
    },
    onError: () => setToast('Failed to send message.'),
  });

  const canSend = !send.isPending && draft.trim() !== '' && teacherId != null;
  const teacherList = teachers.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Communication" />

      <MessageThread
        messages={thread.data ?? []}
        loading={thread.isLoading}
        emptyText="No messages yet."
        fallbackSender="School"
      />

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) send.mutate();
          }}
          className="space-y-3"
        >
          <Field id="guardian-teacher" label="Send to teacher">
            <Select
              id="guardian-teacher"
              value={teacherId ?? ''}
              onChange={(e) => setChosenTeacher(Number(e.target.value))}
              disabled={teacherList.length === 0}
            >
              {teacherList.length === 0 ? (
                <option value="">No teachers available at your child&apos;s school</option>
              ) : (
                teacherList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))
              )}
            </Select>
          </Field>
          <div className="flex gap-2">
            <label htmlFor="guardian-message" className="sr-only">
              Message
            </label>
            <TextInput
              id="guardian-message"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message to the teacher…"
              className="flex-1"
            />
            <Button type="submit" disabled={!canSend} loading={send.isPending} aria-label="Send message">
              {!send.isPending && <Send size={18} aria-hidden="true" />}
            </Button>
          </div>
        </form>
      </Card>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}

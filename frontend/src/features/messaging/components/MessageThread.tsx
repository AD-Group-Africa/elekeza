import type { ReactNode } from 'react';
import { MessageSquare } from 'lucide-react';
import { Card, LoadingState } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import type { Message } from '../api';

/** Scrollable list of received messages, newest data first as the API sends it. */
export function MessageThread({
  messages,
  loading,
  emptyText,
  fallbackSender,
  renderAction,
}: {
  messages: Message[];
  loading: boolean;
  emptyText: string;
  fallbackSender: string;
  /** Optional per-message action (e.g. "Reply"). */
  renderAction?: (m: Message) => ReactNode;
}) {
  return (
    <Card className="max-h-96 space-y-3 overflow-y-auto" role="log" aria-label="Messages">
      {loading ? (
        <LoadingState className="justify-center" />
      ) : messages.length === 0 ? (
        <div className="py-4 text-center">
          <MessageSquare size={48} className="mx-auto mb-2 text-purple-400" aria-hidden="true" />
          <p className="text-purple-300">{emptyText}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {messages.map((m, i) => (
            <li key={m.id ?? i} className="space-y-1 rounded-lg bg-white/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-purple-300">{m.senderName || fallbackSender}</p>
                {renderAction?.(m)}
              </div>
              <p className="text-sm text-purple-200">{m.message}</p>
              {m.timestamp && <p className="text-xs text-purple-400">{formatDateTime(m.timestamp)}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

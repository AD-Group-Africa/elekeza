import { apiClient } from '@/lib/api';

/** A human message (system notifications are excluded server-side). */
export interface Message {
  id?: number;
  senderId: number | null;
  senderName: string | null;
  message: string;
  timestamp: string;
}

export interface TeacherContact {
  id: number;
  name: string;
  email: string;
}

/**
 * Normalises NotificationDto rows ({ body | message, createdAt | timestamp })
 * into Message, dropping empty rows so a malformed one can never blank the thread.
 */
function toMessages(data: unknown): Message[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      const r = row as Record<string, unknown>;
      const body =
        typeof r.body === 'string' && r.body.trim() ? r.body : typeof r.message === 'string' ? r.message : '';
      const created =
        typeof r.createdAt === 'string' ? r.createdAt : typeof r.timestamp === 'string' ? r.timestamp : '';
      return {
        id: typeof r.id === 'number' ? r.id : undefined,
        senderId: typeof r.senderId === 'number' ? r.senderId : null,
        senderName: typeof r.senderName === 'string' ? r.senderName : null,
        message: body,
        timestamp: created,
      };
    })
    .filter((m) => m.message.trim().length > 0);
}

export const messagingApi = {
  // guardian side
  guardianMessages: () => apiClient.get('/guardian/messages').then((r) => toMessages(r.data)),
  guardianTeachers: () =>
    apiClient.get<TeacherContact[]>('/guardian/teachers').then((r) => (Array.isArray(r.data) ? r.data : [])),
  sendToTeacher: (recipientUserId: number, message: string) =>
    apiClient.post('/guardian/messages', { recipientUserId, message }),
  // teacher side
  teacherMessages: () => apiClient.get('/teacher/messages').then((r) => toMessages(r.data)),
  sendToGuardian: (guardianUserId: number, message: string) =>
    apiClient.post('/notifications/send', { recipient: String(guardianUserId), message, type: 'MESSAGE' }),
};

export const messagingKeys = {
  guardianThread: ['messaging', 'guardian'] as const,
  guardianTeachers: ['messaging', 'guardian-teachers'] as const,
  teacherThread: ['messaging', 'teacher'] as const,
};

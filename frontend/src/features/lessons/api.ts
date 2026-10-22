import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export type SectionBody = string | { text?: string; content?: string };

export interface LessonSection {
  heading?: string;
  body: SectionBody;
}

/** GET /api/content/lessons/{id} — the lesson page payload. */
export interface Lesson {
  id?: number;
  title?: string;
  status?: string;
  sections?: LessonSection[];
  keyTerms?: Record<string, string>;
}

/** GET /api/content/list — the signed-in teacher's lessons. */
export interface LessonListItem {
  id: number;
  title: string;
  status: 'READY' | 'PROCESSING' | 'UPLOADING' | 'FAILED' | string;
}

export interface UploadResult {
  lessonId?: number;
  adapted?: boolean;
  message?: string;
}

/** GET /api/teacher/assignments — one lesson assigned to one learner. */
export interface LessonAssignment {
  id: number;
  contentId: number;
  lessonTitle: string;
  studentId: number;
  studentName: string;
  assignedAt: string;
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | string;
  score: number | null;
}

export const lessonsApi = {
  get: (id: string | number) => apiClient.get<Lesson>(`/content/lessons/${id}`).then((r) => r.data),
  list: () => apiClient.get<LessonListItem[]>('/content/list').then((r) => r.data),
  /** File lessons are titled with the file name by the backend. */
  uploadFile: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<UploadResult>('/content/upload/file', form).then((r) => r.data);
  },
  uploadText: (title: string, text: string) =>
    apiClient.post<UploadResult>('/content/upload/text', { title, text }).then((r) => r.data),
  assignments: () => apiClient.get<LessonAssignment[]>('/teacher/assignments').then((r) => r.data),
  assign: (contentId: number, studentIds: number[]) =>
    apiClient.post('/teacher/content/assign', { contentId, studentIds }),
};

export const lessonKeys = {
  detail: (id: string | number) => ['lessons', 'detail', String(id)] as const,
  list: ['lessons', 'list'] as const,
  assignments: ['lessons', 'assignments'] as const,
};

export const useLesson = (id: string | number | undefined) =>
  useQuery({
    queryKey: lessonKeys.detail(id ?? ''),
    queryFn: () => lessonsApi.get(id!),
    enabled: id !== undefined && id !== '',
  });

export const useLessonList = () => useQuery({ queryKey: lessonKeys.list, queryFn: lessonsApi.list });

/** Plain text of a section body (the API sends a string or an object). */
export function sectionText(body: SectionBody | undefined): string {
  if (!body) return '';
  return typeof body === 'string' ? body : body.text || body.content || '';
}

export const LESSON_STATUS_LABEL: Record<string, string> = {
  READY: 'Ready',
  PROCESSING: 'Being prepared',
  UPLOADING: 'Being prepared',
  FAILED: 'Not available yet',
};

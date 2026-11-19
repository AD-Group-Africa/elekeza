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
  /** Linked curriculum objective; 0 or missing = not linked. */
  objectiveId?: number;
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

/** GET /api/content/lessons/{id}/adapted — the lesson rewritten for the learner. */
export interface AdaptedLesson {
  contentId: number;
  lessonTitle: string;
  code: AdaptationCode;
  label: string;
  text: string;
  source: string;
  cached: boolean;
  originalAvailable: boolean;
}

export type AdaptationCode = 'original' | 'clearer' | 'step_by_step' | 'spaced' | 'detailed';

export const ADAPTATIONS: Array<{ code: AdaptationCode; label: string; hint: string }> = [
  { code: 'clearer', label: 'Clearer', hint: 'Short chunks, key words highlighted' },
  { code: 'step_by_step', label: 'Step by step', hint: 'One idea at a time, numbered' },
  { code: 'spaced', label: 'Spaced out', hint: 'One concept per section' },
  { code: 'detailed', label: 'More detail', hint: 'The full lesson, well organised' },
];

export const lessonsApi = {
  get: (id: string | number) => apiClient.get<Lesson>(`/content/lessons/${id}`).then((r) => r.data),
  list: () => apiClient.get<LessonListItem[]>('/content/list').then((r) => r.data),
  adapted: (id: string | number, code: AdaptationCode) =>
    apiClient.get<AdaptedLesson>(`/content/lessons/${id}/adapted`, { params: { code } }).then((r) => r.data),
  feedback: (id: string | number, helpful: boolean, code: AdaptationCode) =>
    apiClient.post(`/content/lessons/${id}/feedback`, { helpful, code }),
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
  adapted: (id: string | number, code: string) => ['lessons', 'adapted', String(id), code] as const,
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

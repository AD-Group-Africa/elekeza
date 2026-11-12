'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Eye, Upload } from 'lucide-react';
import { Alert, Button, ButtonLink, Card, EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { getErrorMessage } from '@/lib/api';
import { flattenObjectives, useCurriculumTree } from '@/features/curriculum/api';
import { lessonKeys, lessonsApi, useLessonList } from '../api';
import { LessonObjectiveSelect } from '../components/LessonObjectiveSelect';

const STATUS_LABEL: Record<string, string> = {
  READY: 'Ready',
  PROCESSING: 'Processing',
  UPLOADING: 'Processing',
  FAILED: 'Failed',
};

/** The teacher's lessons, with quick file upload. */
export default function TeacherLessonsScreen() {
  const queryClient = useQueryClient();
  const lessons = useLessonList();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const upload = useMutation({
    mutationFn: lessonsApi.uploadFile,
    onSuccess: async (res, uploaded) => {
      setMessage({ tone: 'success', text: res.message || `"${uploaded.name}" uploaded.` });
      setFile(null);
      await queryClient.invalidateQueries({ queryKey: lessonKeys.list });
    },
    onError: (err) => setMessage({ tone: 'error', text: getErrorMessage(err, 'Upload failed. Please try again.') }),
  });

  const list = lessons.data ?? [];
  const tree = useCurriculumTree();
  const objectives = flattenObjectives(tree.data ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lessons"
        actions={
          <>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white focus-within:ring-2 focus-within:ring-purple-300">
              <Upload size={18} aria-hidden="true" /> {file ? file.name : 'Choose File'}
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
            {file && (
              <Button
                onClick={() => {
                  setMessage(null);
                  upload.mutate(file);
                }}
                loading={upload.isPending}
              >
                {upload.isPending ? 'Processing…' : 'Upload & Simplify'}
              </Button>
            )}
          </>
        }
      />

      {lessons.isError && <Alert tone="error">Could not load your lessons. Please refresh to try again.</Alert>}
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {lessons.isLoading ? (
        <LoadingState label="Loading lessons…" />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={48} />}
          title="No lessons created yet."
          description="Upload a PDF, DOCX, or TXT file to generate your first lesson."
          action={<ButtonLink href="/teacher/content">Create a lesson</ButtonLink>}
        />
      ) : (
        <Card>
          <ul className="space-y-3">
            {list.map((lesson) => (
              <li
                key={lesson.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/5 p-4"
              >
                <div className="space-y-2">
                  <h2 className="font-semibold text-purple-200">{lesson.title}</h2>
                  <p className="text-sm text-purple-300">{STATUS_LABEL[lesson.status] ?? lesson.status}</p>
                  {objectives.length > 0 && (
                    <LessonObjectiveSelect
                      lessonId={lesson.id}
                      lessonTitle={lesson.title}
                      objectiveId={lesson.objectiveId || null}
                      objectives={objectives}
                    />
                  )}
                </div>
                <Link
                  href={ROUTES.lesson(lesson.id)}
                  className="flex items-center gap-1 text-purple-300 hover:text-white"
                >
                  <Eye size={18} aria-hidden="true" /> View
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

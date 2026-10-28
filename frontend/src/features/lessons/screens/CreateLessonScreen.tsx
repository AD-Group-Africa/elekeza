'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Eye, Send, Upload } from 'lucide-react';
import { Alert, Button, Card, Field, PageHeader, TextInput, Textarea } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { lessonKeys, lessonsApi, type UploadResult } from '../api';

const STEPS = ['Details', 'Upload', 'Preview', 'Assign'] as const;

/** Four-step lesson wizard: title → content (file or text) → preview → assign. */
export default function CreateLessonScreen() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [topic, setTopic] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [result, setResult] = useState<UploadResult | null>(null);

  const upload = useMutation({
    mutationFn: () => (file ? lessonsApi.uploadFile(file) : lessonsApi.uploadText(topic, text)),
    onSuccess: async (res) => {
      setResult(res);
      setStep(2);
      await queryClient.invalidateQueries({ queryKey: lessonKeys.list });
    },
  });

  const reset = () => {
    setStep(0);
    setTopic('');
    setFile(null);
    setText('');
    setResult(null);
    upload.reset();
  };

  // The backend reports whether AI adaptation actually ran (offline/mock AI
  // stores the raw text and says so).
  const previewMessage = result?.adapted
    ? 'AI has simplified your lesson. Review it below.'
    : result?.message || 'Content saved — review it below.';

  return (
    <div className="space-y-6">
      <PageHeader title="Create New Lesson" />

      <ol className="flex flex-wrap items-center gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2" aria-current={i === step ? 'step' : undefined}>
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                i === step
                  ? 'bg-purple-600 text-white'
                  : i < step
                    ? 'bg-green-600 text-white'
                    : 'bg-white/10 text-purple-300',
              )}
            >
              {i < step ? <Check size={16} aria-label="done" /> : i + 1}
            </div>
            <span className="hidden text-xs text-purple-300 md:block">{s}</span>
            {i < STEPS.length - 1 && <div className="h-px w-8 bg-purple-300/30" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card padding="lg" title="Lesson Details" className="space-y-4">
          <Field id="lesson-topic" label="Lesson title / topic">
            <TextInput
              id="lesson-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. The Water Cycle"
            />
          </Field>
          <Button onClick={() => setStep(1)} disabled={!topic.trim()}>
            Next <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </Card>
      )}

      {step === 1 && (
        <Card padding="lg" title="Upload Content" className="space-y-4">
          <div className="rounded-lg border-2 border-dashed border-purple-300/30 p-8 text-center">
            <Upload size={40} className="mx-auto mb-3 text-purple-300" aria-hidden="true" />
            <label htmlFor="lesson-file" className="text-purple-200">
              Upload a file (PDF, DOCX, TXT)
            </label>
            <input
              id="lesson-file"
              type="file"
              accept=".pdf,.docx,.txt,.doc"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-4 block w-full text-purple-200 file:mr-4 file:rounded-lg file:border-0 file:bg-purple-600 file:px-4 file:py-2 file:text-white"
            />
            {file && <p className="mt-2 text-xs text-purple-300">File lessons are titled with the file name.</p>}
          </div>
          <Field id="lesson-text" label="Or paste text:">
            <Textarea
              id="lesson-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder="Paste lesson content here..."
              disabled={!!file}
            />
          </Field>
          {upload.isError && (
            <Alert tone="error">{getErrorMessage(upload.error, 'Upload failed. Please try again.')}</Alert>
          )}
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(0)}>
              <ArrowLeft size={18} aria-hidden="true" /> Back
            </Button>
            <Button onClick={() => upload.mutate()} disabled={!file && !text.trim()} loading={upload.isPending}>
              {upload.isPending ? 'Processing…' : 'Upload & Simplify'}
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card padding="lg" title="Preview" className="space-y-4">
          <p className="text-purple-300" role="status">
            {previewMessage}
          </p>
          {result?.lessonId != null && (
            <Link
              href={ROUTES.lesson(result.lessonId)}
              className="flex items-center gap-1 text-purple-300 hover:text-white"
            >
              <Eye size={18} aria-hidden="true" /> Preview Lesson
            </Link>
          )}
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft size={18} aria-hidden="true" /> Back
            </Button>
            <Button onClick={() => setStep(3)}>
              Next <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card padding="lg" title="Assign" className="space-y-4">
          <p className="text-purple-300">
            Lesson created! Assign it to your students from the{' '}
            <Link href="/teacher/assignments" className="text-purple-400 underline">
              Assignments
            </Link>{' '}
            page.
          </p>
          <Button onClick={reset} icon={<Send size={18} aria-hidden="true" />}>
            Create Another
          </Button>
        </Card>
      )}
    </div>
  );
}

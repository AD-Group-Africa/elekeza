'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { Alert, Button, LoadingState } from '@/components/ui';
import { lessonKeys, lessonsApi, type AdaptationCode } from '../api';

/**
 * The lesson rewritten in the chosen style, plus "Was this helpful?" — the
 * learner's answer tunes which version Elekeza suggests next time.
 */
export function AdaptedLessonView({ lessonId, code }: { lessonId: string; code: AdaptationCode }) {
  const variant = useQuery({
    queryKey: lessonKeys.adapted(lessonId, code),
    queryFn: () => lessonsApi.adapted(lessonId, code),
    retry: false,
  });
  const [answered, setAnswered] = useState<boolean | null>(null);
  const feedback = useMutation({
    mutationFn: (helpful: boolean) => lessonsApi.feedback(lessonId, helpful, code),
    onSuccess: (_r, helpful) => setAnswered(helpful),
  });

  if (variant.isLoading) return <LoadingState label="Rewriting this lesson for you…" />;
  if (variant.isError || !variant.data) {
    return (
      <Alert tone="warning">This version is not available right now. You can keep reading the lesson as it is.</Alert>
    );
  }

  return (
    <section className="glass-card space-y-4 p-5" aria-label={`${variant.data.label} version of the lesson`}>
      <div className="whitespace-pre-line leading-relaxed text-purple-100">{variant.data.text}</div>
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3 text-sm">
        {answered === null ? (
          <>
            <span className="text-purple-200">Did this version help you understand?</span>
            <Button
              size="sm"
              variant="secondary"
              icon={<ThumbsUp size={14} aria-hidden="true" />}
              loading={feedback.isPending}
              onClick={() => feedback.mutate(true)}
            >
              Yes
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<ThumbsDown size={14} aria-hidden="true" />}
              disabled={feedback.isPending}
              onClick={() => feedback.mutate(false)}
            >
              Not really
            </Button>
          </>
        ) : (
          <p className="text-purple-200" role="status">
            {answered ? 'Great — Elekeza will remember what works for you.' : 'Thanks — try another version above.'}
          </p>
        )}
      </div>
    </section>
  );
}

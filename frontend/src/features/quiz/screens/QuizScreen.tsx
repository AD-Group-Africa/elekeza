'use client';

/**
 * Practice quiz. Each answer is graded server-side (the answer key is never
 * sent while answering); completion is server-scored. Offline, answers are
 * queued in IndexedDB and synced when connectivity returns.
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, RefreshCw, SkipForward, WifiOff, X } from 'lucide-react';
import { ButtonLink, LoadingState } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { getErrorStatus } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Celebration, LearningCompanion, type CelebrationData } from '@/features/learner';
import { learnerApi, learnerKeys } from '@/features/learner/api';
import { optionLetter, optionsOf, quizApi, quizKeys, useLessonQuiz, type QuizFeedback } from '../api';
import { useOfflineSync } from '../useOfflineSync';

interface AnswerState {
  correct: boolean;
  learnerMessage?: string;
  directive?: string;
  /** Saved offline, waiting to sync. */
  queued?: boolean;
  /** Never reached the server; the learner may retry. */
  failed?: boolean;
}

/** Wall-clock time for answer-latency measurement (event handlers only). */
const now = () => Date.now();
const AUTO_ADVANCE_MS = 700;

function celebrationFor(
  score: number,
  points: number,
  level: number,
  levelName: string,
  achievements: string[],
): CelebrationData {
  // XP matches the backend economy (GamificationController: 10 points per completed quiz, 50 per level).
  const prevLevel = Math.floor((points - 10) / 50) + 1;
  return {
    score,
    stars: score >= 90 ? 5 : score >= 75 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : 1,
    xpEarned: 10,
    newAchievements: achievements.slice(-2),
    levelUp: level > prevLevel ? { level, levelName } : null,
    companionMessage:
      score >= 90
        ? 'Wow! You really know this. Shall we try another adventure?'
        : score >= 60
          ? 'Strong work! Every try makes you stronger.'
          : 'Well done for finishing — that is how learning grows!',
  };
}

export default function QuizScreen() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const quizQuery = useLessonQuiz(lessonId);
  const quiz = quizQuery.data;
  const { isOnline, pendingCount, queueAnswer } = useOfflineSync();

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [results, setResults] = useState<Record<number, AnswerState>>({});
  const [completion, setCompletion] = useState<{ score: number; feedback: QuizFeedback[] } | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [offlineNotice, setOfflineNotice] = useState(false);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const questionStart = useRef(0);

  // Restart the latency timer whenever the question changes.
  useEffect(() => {
    questionStart.current = now();
  }, [currentQ]);

  if (quizQuery.isLoading) return <LoadingState label="Loading quiz…" />;
  if (!quiz || !quiz.questions?.length) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-purple-200">
          This practice quiz isn&apos;t available right now. You can keep reading the lesson and come back to it in a
          moment.
        </p>
        <ButtonLink href="/student-home">Back to your home</ButtonLink>
      </div>
    );
  }

  const total = quiz.questions.length;
  const advanceFrom = (questionIndex: number) =>
    setTimeout(
      () => setCurrentQ((cur) => (cur !== questionIndex ? cur : Math.min(cur + 1, total - 1))),
      AUTO_ADVANCE_MS,
    );

  const handleAnswer = async (optionIdx: number) => {
    const qIndex = currentQ;
    if (completion || answers[qIndex] !== undefined) return;
    const q = quiz.questions[qIndex];
    const latencyMs = now() - questionStart.current;
    setAnswers((prev) => ({ ...prev, [qIndex]: optionIdx }));

    if (!isOnline) {
      // Offline: persist to the IndexedDB sync queue (idempotency key per
      // answer); the backend deduplicates per (attempt, question).
      await queueAnswer(String(quiz.quizId), String(q.id), optionLetter(optionIdx));
      setResults((prev) => ({ ...prev, [qIndex]: { correct: false, queued: true } }));
      advanceFrom(qIndex);
      return;
    }
    try {
      const res = await quizApi.answer(quiz.quizId, q.id, optionLetter(optionIdx), latencyMs);
      setResults((prev) => ({
        ...prev,
        [qIndex]: { correct: res.correct, learnerMessage: res.learnerMessage, directive: res.directive },
      }));
      advanceFrom(qIndex);
    } catch {
      // The answer did not reach the server: un-select it so the learner can
      // actually try again, and stay on this question.
      setAnswers((prev) => {
        const next = { ...prev };
        delete next[qIndex];
        return next;
      });
      setResults((prev) => ({
        ...prev,
        [qIndex]: {
          correct: false,
          failed: true,
          learnerMessage: 'We could not save that answer. Check your connection and try again.',
        },
      }));
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!isOnline) {
      // Completing is server-scored; offline we can only keep the answers.
      setOfflineNotice(true);
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await quizApi.complete(
        quiz.quizId,
        quiz.questions.map((q, idx) => ({ questionId: q.id, selectedOption: optionLetter(answers[idx] ?? -1) })),
      );
      setCompletion({ score: res.score, feedback: res.feedback ?? [] });
      // Progress, XP and the next attempt all changed on the server.
      void queryClient.invalidateQueries({ queryKey: ['learner'] });
      queryClient.removeQueries({ queryKey: quizKeys.start(lessonId) });
      // Reward moment — optional; never blocks the result.
      try {
        const g = await queryClient.fetchQuery({
          queryKey: learnerKeys.gamification,
          queryFn: learnerApi.gamification,
        });
        setCelebration(celebrationFor(res.score, g.points, g.level, g.levelName, g.achievements || []));
      } catch {
        /* celebration is enhancement, not requirement */
      }
    } catch (err) {
      // 409: this attempt was already submitted — show the saved review.
      if (getErrorStatus(err) === 409) router.push(ROUTES.quizReview(quiz.quizId));
      else setSubmitError('We could not submit your quiz. Your answers are kept — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const q = quiz.questions[currentQ];
  const options = optionsOf(q);
  const result = results[currentQ];
  const allAnswered = Object.keys(answers).length >= total;

  return (
    <>
      {celebration && <Celebration data={celebration} onContinue={() => setCelebration(null)} />}
      <div className="mx-auto max-w-2xl space-y-8">
        {!isOnline && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg bg-amber-500/20 px-4 py-2 text-sm text-amber-200"
          >
            <WifiOff size={16} aria-hidden="true" /> Offline — answers are saved locally
            {pendingCount > 0 ? ` (${pendingCount} waiting to sync)` : ''} and will sync when you reconnect.
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-sm text-purple-300">
            {currentQ + 1} / {total}
          </span>
          <div className="h-2 flex-1 rounded-full bg-white/10">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
              style={{ width: `${((currentQ + 1) / total) * 100}%` }}
              role="progressbar"
              aria-valuenow={currentQ + 1}
              aria-valuemin={1}
              aria-valuemax={total}
              aria-label="Question progress"
            />
          </div>
        </div>

        {completion ? (
          <div className="glass-card p-8 text-center">
            <LearningCompanion state="success" size={96} className="mx-auto" />
            <h1 className="mb-2 text-2xl font-bold text-purple-200">Quiz Complete!</h1>
            <p className="text-3xl font-bold text-purple-100">{completion.score}%</p>
            <p className="mt-2 text-purple-300">Great effort! Keep up the good work.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowReview((s) => !s)}
                className="rounded-lg bg-purple-600 px-6 py-3 text-white"
              >
                {showReview ? 'Hide Answers' : 'Review Answers'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/student-home')}
                className="rounded-lg bg-white/10 px-6 py-3 text-purple-200 hover:bg-white/20"
              >
                Back to Dashboard
              </button>
            </div>
            {showReview && (
              <ul className="mt-6 space-y-3 text-left">
                {completion.feedback.map((f, idx) => (
                  <li key={idx} className="rounded-lg border border-purple-300/20 bg-white/5 p-4">
                    <div className="flex items-start gap-2">
                      {f.correct ? (
                        <Check size={18} className="mt-1 text-green-400" aria-label="Correct" />
                      ) : (
                        <X size={18} className="mt-1 text-red-400" aria-label="Incorrect" />
                      )}
                      <div>
                        <p className="font-semibold text-purple-200">
                          {quiz.questions[idx]?.questionText || quiz.questions[idx]?.question || `Question ${idx + 1}`}
                        </p>
                        {!f.correct && <p className="text-sm text-green-300">Correct: {f.correctOption}</p>}
                        {f.explanation && <p className="mt-1 text-xs text-purple-400">{f.explanation}</p>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <>
            <div className="glass-card p-6">
              <h1 className="mb-6 text-lg font-semibold text-purple-200">{q.questionText || q.question}</h1>
              <div className="space-y-3">
                {options.map((opt, idx) => {
                  const chosen = answers[currentQ] === idx;
                  const tone = !chosen
                    ? 'bg-white/5 border-purple-300/20 text-purple-200 hover:bg-white/10'
                    : !result || result.queued
                      ? 'bg-purple-600/40 border-purple-500 text-white'
                      : result.correct
                        ? 'bg-green-600/30 border-green-500 text-white'
                        : 'bg-red-600/30 border-red-500 text-white';
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAnswer(idx)}
                      disabled={answers[currentQ] !== undefined}
                      aria-pressed={chosen}
                      className={cn('w-full rounded-lg border p-4 text-left transition', tone)}
                    >
                      <span className="mr-2 font-bold">{optionLetter(idx)}.</span> {opt}
                    </button>
                  );
                })}
              </div>
              {result && (
                <div
                  role="status"
                  className={cn(
                    'mt-4 rounded-lg p-3 text-sm',
                    result.queued
                      ? 'bg-amber-500/20 text-amber-200'
                      : result.correct
                        ? 'bg-green-600/20 text-green-200'
                        : 'bg-red-600/20 text-red-200',
                  )}
                >
                  {result.failed
                    ? result.learnerMessage
                    : result.queued
                      ? 'Saved offline — will sync when you reconnect.'
                      : result.correct
                        ? 'Correct! Well done.'
                        : 'Not quite — keep going, you are learning.'}
                  {result.learnerMessage && !result.failed && (
                    <p className="mt-1 text-purple-200">{result.learnerMessage}</p>
                  )}
                  {result.directive && !result.correct && (
                    <p className="mt-1 text-purple-300">Tip: {result.directive}</p>
                  )}
                </div>
              )}
            </div>

            {submitError && (
              <p role="alert" className="text-sm text-red-300">
                {submitError}
              </p>
            )}
            {offlineNotice && (
              <p role="alert" className="text-sm text-amber-200">
                You&apos;re offline. Answers are saved locally — submit again once you reconnect.
              </p>
            )}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setCurrentQ((c) => Math.max(0, c - 1))}
                disabled={currentQ === 0}
                className="flex items-center gap-1 text-purple-300 disabled:opacity-30"
              >
                <ChevronLeft size={18} aria-hidden="true" /> Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentQ((c) => Math.min(c + 1, total - 1))}
                disabled={currentQ === total - 1}
                className="flex items-center gap-1 text-purple-300 disabled:opacity-30"
              >
                Skip <SkipForward size={18} aria-hidden="true" />
              </button>
              {currentQ === total - 1 ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!allAnswered || submitting}
                  title={allAnswered ? undefined : 'Answer every question to submit'}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-white disabled:opacity-50"
                >
                  {submitting && <RefreshCw size={16} className="animate-spin" aria-hidden="true" />} Submit
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCurrentQ((c) => c + 1)}
                  className="flex items-center gap-1 text-purple-300"
                >
                  Next <ChevronRight size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

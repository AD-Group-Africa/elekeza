'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { ChevronRight, ChevronLeft, SkipForward, Check, X, Award, RefreshCw, WifiOff } from 'lucide-react';
import Celebration, { CelebrationData } from '@/components/learner/Celebration';
import LearningCompanion from '@/components/learner/LearningCompanion';

interface QuizQuestion {
  id: string | number;
  questionText?: string;
  question?: string;
  options?: string[] | string;
}

interface QuizData {
  quizId: string | number;
  questions: QuizQuestion[];
}

interface FeedbackRow {
  correct: boolean;
  correctOption?: string;
  explanation?: string;
}

interface AnswerResult {
  correct: boolean;
  learnerMessage?: string;
  directive?: string;
  queued?: boolean;
}

export default function QuizPage() {
  const { lessonId } = useParams();
  const router = useRouter();
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [results, setResults] = useState<Record<number, AnswerResult>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const [offlineNotice, setOfflineNotice] = useState(false);
  const { isOnline, pendingCount, queueAnswer } = useOfflineSync();
  const questionStart = useRef(Date.now());

  useEffect(() => {
    api.get('/quiz/' + lessonId + '/start')
      .then(res => setQuiz(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [lessonId]);

  // Restart the latency timer whenever the question changes.
  useEffect(() => {
    questionStart.current = Date.now();
  }, [currentQ]);

  const letterFor = (optionIdx: number) => String.fromCharCode(65 + optionIdx);

  // Each answer is graded server-side via /quiz/{quizId}/answer. The response
  // contains only `correct` (+ optional adaptive learnerMessage/directive) —
  // the answer key is never sent to the client while answering.
  const handleAnswer = async (optionIdx: number) => {
    if (submitted || answers[currentQ] !== undefined || !quiz) return;
    const q = quiz.questions[currentQ];
    const latencyMs = Date.now() - questionStart.current;
    setAnswers(prev => ({ ...prev, [currentQ]: optionIdx }));
    if (!isOnline) {
      // Offline: persist to the IndexedDB sync queue (idempotency key per
      // answer). flushQueue posts them when connectivity returns; the backend
      // deduplicates per (attemptId, questionId), so no double submission.
      await queueAnswer(String(quiz.quizId), String(q.id), letterFor(optionIdx));
      setResults(prev => ({
        ...prev,
        [currentQ]: {
          correct: false,
          queued: true,
          learnerMessage: 'Saved offline — will sync when you reconnect.',
        },
      }));
      setTimeout(() => {
        setCurrentQ(prev => {
          // If the learner already navigated (Next/Skip), don't double-advance.
          if (prev !== currentQ) return prev;
          return Math.min(prev + 1, (quiz?.questions?.length || 1) - 1);
        });
      }, 700);
      return;
    }
    try {
      const res = await api.post('/quiz/' + quiz.quizId + '/answer', {
        questionId: q.id,
        selectedOptionId: letterFor(optionIdx),
        latencyMs,
      });
      setResults(prev => ({
        ...prev,
        [currentQ]: {
          correct: res.data.correct,
          learnerMessage: res.data.learnerMessage,
          directive: res.data.directive,
        },
      }));
    } catch (err) {
      console.error(err);
      setResults(prev => ({ ...prev, [currentQ]: { correct: false } }));
    }
    // Auto-advance after the server responds (skip if the learner already navigated).
    setTimeout(() => {
      setCurrentQ(prev => {
        if (prev !== currentQ) return prev;
        return Math.min(prev + 1, (quiz?.questions?.length || 1) - 1);
      });
    }, 700);
  };

  const handleSubmit = async () => {
    if (!quiz || submitting) return;
    if (!isOnline) {
      // Completing is server-scored; while offline we can only persist the
      // answers. The learner submits again once connectivity returns.
      setOfflineNotice(true);
      return;
    }
    setSubmitting(true);
    const answersArray = quiz.questions.map((q: QuizQuestion, idx: number) => ({
      questionId: q.id,
      selectedOption: letterFor(answers[idx] ?? -1),
    }));
    try {
      const res = await api.post('/quiz/' + quiz.quizId + '/complete', answersArray);
      setScore(res.data.score);
      setFeedback(res.data.feedback || []);
      setSubmitted(true);
      // Reward moment: fetch the learner's (already updated) gamification
      // state and celebrate. The XP shown matches the backend economy
      // (GamificationController: 10 points per completed quiz). Never blocks
      // on failure — celebration is enhancement, not requirement.
      try {
        const g = (await api.get('/gamification/student')).data;
        const stars = res.data.score >= 90 ? 5 : res.data.score >= 75 ? 4 : res.data.score >= 60 ? 3 : res.data.score >= 40 ? 2 : 1;
        const prevLevel = Math.floor((g.points - 10) / 50) + 1;
        setCelebration({
          score: res.data.score,
          stars,
          xpEarned: 10,
          newAchievements: (g.achievements || []).slice(-2),
          levelUp: g.level > prevLevel ? { level: g.level, levelName: g.levelName } : null,
          companionMessage: res.data.score >= 90
            ? 'Wow! You really know this. Shall we try another adventure?'
            : res.data.score >= 60
              ? 'Strong work! Every try makes you stronger.'
              : 'Well done for finishing — that is how learning grows!',
        });
      } catch { /* celebration is optional */ }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (currentQ < (quiz?.questions?.length || 1) - 1) {
      setCurrentQ(prev => prev + 1);
    }
  };

  if (loading) return <SidebarLayout><div className="p-6 text-purple-200">Loading quiz…</div></SidebarLayout>;
  if (!quiz) return <SidebarLayout><div className="p-6 text-red-400">Quiz not found.</div></SidebarLayout>;

  const q = quiz.questions[currentQ];
  const options = q.options ? (Array.isArray(q.options) ? q.options : q.options.split('\n').filter((o: string) => o.trim().length > 0)) : [];
  const result = results[currentQ];

  return (
    <SidebarLayout>
      {celebration && <Celebration data={celebration} />}
      <div className="max-w-2xl mx-auto space-y-8">
        {!isOnline && (
          <div role="status" className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-amber-500/20 text-amber-200">
            <WifiOff size={16} /> Offline — answers are saved locally{pendingCount > 0 ? ` (${pendingCount} waiting to sync)` : ''} and will sync when you reconnect.
          </div>
        )}

        {/* Progress Bar */}
        <div className="flex items-center gap-2">
          <span className="text-purple-300 text-sm">{currentQ + 1} / {quiz.questions.length}</span>
          <div className="flex-1 bg-white/10 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all"
              style={{ width: ((currentQ + 1) / quiz.questions.length) * 100 + '%' }}
            />
          </div>
        </div>

        {submitted ? (
          <div className="glass-card p-8 text-center">
            <LearningCompanion state="success" size={96} className="mx-auto" />
            <h2 className="text-2xl font-bold text-purple-200 mb-2">Quiz Complete!</h2>
            <p className="text-3xl font-bold text-purple-100">{score}%</p>
            <p className="text-purple-300 mt-2">Great effort! Keep up the good work.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => setShowReview(prev => !prev)}
                className="bg-purple-600 text-white px-6 py-3 rounded-lg"
              >
                {showReview ? 'Hide Answers' : 'Review Answers'}
              </button>
              <button
                onClick={() => router.push('/student-home')}
                className="bg-white/10 text-purple-200 px-6 py-3 rounded-lg hover:bg-white/20"
              >
                Back to Dashboard
              </button>
            </div>
            {showReview && (
              <div className="mt-6 text-left space-y-3">
                {feedback.map((f: FeedbackRow, idx: number) => (
                  <div key={idx} className="bg-white/5 border border-purple-300/20 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      {f.correct ? (
                        <Check size={18} className="text-green-400 mt-1" />
                      ) : (
                        <X size={18} className="text-red-400 mt-1" />
                      )}
                      <div>
                        <p className="text-purple-200 font-semibold">{quiz.questions[idx]?.questionText || `Question ${idx + 1}`}</p>
                        {!f.correct && <p className="text-green-300 text-sm">Correct: {f.correctOption}</p>}
                        {f.explanation && <p className="text-purple-400 text-xs mt-1">{f.explanation}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-purple-200 mb-6">{q.questionText || q.question}</h2>
              <div className="space-y-3">
                {options.map((opt: string, idx: number) => {
                  const chosen = answers[currentQ] === idx;
                  let cls = 'bg-white/5 border-purple-300/20 text-purple-200 hover:bg-white/10';
                  if (chosen && result) {
                    cls = result.queued
                      ? 'bg-purple-600/40 border-purple-500 text-white'
                      : result.correct
                        ? 'bg-green-600/30 border-green-500 text-white'
                        : 'bg-red-600/30 border-red-500 text-white';
                  } else if (chosen) {
                    cls = 'bg-purple-600/40 border-purple-500 text-white';
                  }
                  return (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(idx)}
                      disabled={submitted || answers[currentQ] !== undefined}
                      className={'w-full text-left p-4 rounded-lg border transition ' + cls}
                    >
                      <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span> {opt}
                    </button>
                  );
                })}
              </div>
              {result && (
                <div className={'mt-4 p-3 rounded-lg text-sm ' + (result.queued ? 'bg-amber-500/20 text-amber-200' : result.correct ? 'bg-green-600/20 text-green-200' : 'bg-red-600/20 text-red-200')}>
                  {result.queued ? 'Saved offline — will sync when you reconnect.' : result.correct ? 'Correct! Well done.' : 'Not quite — keep going, you are learning.'}
                  {result.learnerMessage && <p className="mt-1 text-purple-200">{result.learnerMessage}</p>}
                  {result.directive && !result.correct && (
                    <p className="mt-1 text-purple-300">Tip: {result.directive}</p>
                  )}
                </div>
              )}
            </div>

            {offlineNotice && (
              <p role="alert" className="text-amber-200 text-sm">You&apos;re offline. Answers are saved locally — submit again once you reconnect.</p>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setCurrentQ(prev => Math.max(0, prev - 1))}
                disabled={currentQ === 0}
                className="text-purple-300 disabled:opacity-30 flex items-center gap-1"
              >
                <ChevronLeft size={18} /> Previous
              </button>
              <button onClick={handleSkip} className="text-purple-300 flex items-center gap-1">
                Skip <SkipForward size={18} />
              </button>
              {currentQ === quiz.questions.length - 1 ? (
                <button
                  onClick={handleSubmit}
                  disabled={Object.keys(answers).length < quiz.questions.length || submitting}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <RefreshCw size={16} className="animate-spin" />} Submit
                </button>
              ) : (
                <button
                  onClick={() => setCurrentQ(prev => prev + 1)}
                  className="text-purple-300 flex items-center gap-1"
                >
                  Next <ChevronRight size={18} />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </SidebarLayout>
  );
}

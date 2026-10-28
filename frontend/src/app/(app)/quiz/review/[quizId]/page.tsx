import type { Metadata } from 'next';
import QuizReviewScreen from '@/features/quiz/screens/QuizReviewScreen';

export const metadata: Metadata = { title: 'Quiz review' };

export default function Page() {
  return <QuizReviewScreen />;
}

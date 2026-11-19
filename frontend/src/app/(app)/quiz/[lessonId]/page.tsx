import type { Metadata } from 'next';
import QuizScreen from '@/features/quiz/screens/QuizScreen';

export const metadata: Metadata = { title: 'Practice quiz' };

export default function Page() {
  return <QuizScreen />;
}

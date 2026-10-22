import type { Metadata } from 'next';
import QuizResultsScreen from '@/features/teacher/screens/QuizResultsScreen';

export const metadata: Metadata = { title: 'Quiz results' };

export default function Page() {
  return <QuizResultsScreen />;
}

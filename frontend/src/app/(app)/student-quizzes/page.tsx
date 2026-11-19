import type { Metadata } from 'next';
import LearnerQuizzesScreen from '@/features/quiz/screens/LearnerQuizzesScreen';

export const metadata: Metadata = { title: 'My quizzes' };

export default function Page() {
  return <LearnerQuizzesScreen />;
}

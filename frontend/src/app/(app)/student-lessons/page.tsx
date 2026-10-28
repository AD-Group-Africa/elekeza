import type { Metadata } from 'next';
import LearnerLessonsScreen from '@/features/learner/screens/LearnerLessonsScreen';

export const metadata: Metadata = { title: 'My lessons' };

export default function Page() {
  return <LearnerLessonsScreen />;
}

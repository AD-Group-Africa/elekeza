import type { Metadata } from 'next';
import LearnerHomeScreen from '@/features/learner/screens/LearnerHomeScreen';

export const metadata: Metadata = { title: 'Home' };

export default function Page() {
  return <LearnerHomeScreen />;
}

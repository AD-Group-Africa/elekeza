import type { Metadata } from 'next';
import LearnersScreen from '@/features/learners/screens/LearnersScreen';

export const metadata: Metadata = { title: 'Learners' };

export default function Page() {
  return <LearnersScreen />;
}

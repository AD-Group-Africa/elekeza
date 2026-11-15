import type { Metadata } from 'next';
import ProgressScreen from '@/features/learner/screens/ProgressScreen';

export const metadata: Metadata = { title: 'My progress' };

export default function Page() {
  return <ProgressScreen />;
}

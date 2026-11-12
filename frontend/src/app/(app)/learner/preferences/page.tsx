import type { Metadata } from 'next';
import LearningPreferencesScreen from '@/features/learner/screens/LearningPreferencesScreen';

export const metadata: Metadata = { title: 'How I learn' };

export default function Page() {
  return <LearningPreferencesScreen />;
}

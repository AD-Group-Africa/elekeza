import type { Metadata } from 'next';
import OnboardingScreen from '@/features/learner/screens/OnboardingScreen';

export const metadata: Metadata = { title: 'Set up your learning' };

export default function Page() {
  return <OnboardingScreen />;
}

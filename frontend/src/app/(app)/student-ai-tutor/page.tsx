import type { Metadata } from 'next';
import TutorScreen from '@/features/tutor/screens/TutorScreen';

export const metadata: Metadata = { title: 'AI Tutor' };

export default function Page() {
  return <TutorScreen />;
}

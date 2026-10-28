import type { Metadata } from 'next';
import CreateLessonScreen from '@/features/lessons/screens/CreateLessonScreen';

export const metadata: Metadata = { title: 'Create a lesson' };

export default function Page() {
  return <CreateLessonScreen />;
}

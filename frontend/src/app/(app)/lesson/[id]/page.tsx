import type { Metadata } from 'next';
import LessonScreen from '@/features/lessons/screens/LessonScreen';

export const metadata: Metadata = { title: 'Lesson' };

export default function Page() {
  return <LessonScreen />;
}

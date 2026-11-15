import type { Metadata } from 'next';
import LessonAssignmentsScreen from '@/features/lessons/screens/LessonAssignmentsScreen';

export const metadata: Metadata = { title: 'Lesson assignments' };

export default function Page() {
  return <LessonAssignmentsScreen />;
}

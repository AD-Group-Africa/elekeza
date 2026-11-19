import type { Metadata } from 'next';
import TeacherLessonsScreen from '@/features/lessons/screens/TeacherLessonsScreen';

export const metadata: Metadata = { title: 'Lessons' };

export default function Page() {
  return <TeacherLessonsScreen />;
}

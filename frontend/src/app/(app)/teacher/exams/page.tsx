import type { Metadata } from 'next';
import TeacherExamsScreen from '@/features/exams/screens/TeacherExamsScreen';

export const metadata: Metadata = { title: 'Exams' };

export default function Page() {
  return <TeacherExamsScreen />;
}

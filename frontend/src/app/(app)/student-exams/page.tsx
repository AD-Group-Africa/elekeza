import type { Metadata } from 'next';
import StudentExamsScreen from '@/features/exams/screens/StudentExamsScreen';

export const metadata: Metadata = { title: 'My exams' };

export default function Page() {
  return <StudentExamsScreen />;
}

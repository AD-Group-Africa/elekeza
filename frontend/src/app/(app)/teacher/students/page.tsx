import type { Metadata } from 'next';
import StudentsScreen from '@/features/teacher/screens/StudentsScreen';

export const metadata: Metadata = { title: 'Students' };

export default function Page() {
  return <StudentsScreen />;
}

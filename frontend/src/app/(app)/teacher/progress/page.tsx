import type { Metadata } from 'next';
import ClassProgressScreen from '@/features/teacher/screens/ClassProgressScreen';

export const metadata: Metadata = { title: 'Progress tracking' };

export default function Page() {
  return <ClassProgressScreen />;
}

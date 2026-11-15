import type { Metadata } from 'next';
import ClassworkScreen from '@/features/assignments/screens/ClassworkScreen';

export const metadata: Metadata = { title: 'Classwork' };

export default function Page() {
  return <ClassworkScreen />;
}

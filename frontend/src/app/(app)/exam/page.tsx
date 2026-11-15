import type { Metadata } from 'next';
import ExamRedirectScreen from '@/features/exams/screens/ExamRedirectScreen';

export const metadata: Metadata = { title: 'Exams' };

export default function Page() {
  return <ExamRedirectScreen />;
}

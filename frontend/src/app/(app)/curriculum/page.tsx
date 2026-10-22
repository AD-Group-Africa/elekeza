import type { Metadata } from 'next';
import CurriculumScreen from '@/features/curriculum/screens/CurriculumScreen';

export const metadata: Metadata = { title: 'Curriculum' };

export default function Page() {
  return <CurriculumScreen />;
}

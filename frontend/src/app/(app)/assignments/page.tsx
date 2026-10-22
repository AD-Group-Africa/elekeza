import type { Metadata } from 'next';
import LearnerAssignmentsScreen from '@/features/assignments/screens/LearnerAssignmentsScreen';

export const metadata: Metadata = { title: 'My assignments' };

export default function Page() {
  return <LearnerAssignmentsScreen />;
}

import type { Metadata } from 'next';
import TeacherDashboardScreen from '@/features/teacher/screens/TeacherDashboardScreen';

export const metadata: Metadata = { title: 'Teacher dashboard' };

export default function Page() {
  return <TeacherDashboardScreen />;
}

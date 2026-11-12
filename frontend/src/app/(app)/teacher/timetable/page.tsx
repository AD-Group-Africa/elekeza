import type { Metadata } from 'next';
import TimetableScreen from '@/features/teacher/screens/TimetableScreen';

export const metadata: Metadata = { title: 'Timetable' };

export default function Page() {
  return <TimetableScreen />;
}

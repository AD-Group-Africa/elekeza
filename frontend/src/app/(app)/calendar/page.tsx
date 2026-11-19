import type { Metadata } from 'next';
import CalendarScreen from '@/features/calendar/screens/CalendarScreen';

export const metadata: Metadata = { title: 'School calendar' };

export default function Page() {
  return <CalendarScreen />;
}

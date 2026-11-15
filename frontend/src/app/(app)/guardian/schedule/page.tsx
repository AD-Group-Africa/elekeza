import type { Metadata } from 'next';
import ScheduleScreen from '@/features/guardian/screens/ScheduleScreen';

export const metadata: Metadata = { title: 'Schedule' };

export default function Page() {
  return <ScheduleScreen />;
}

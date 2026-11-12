import type { Metadata } from 'next';
import AttendanceScreen from '@/features/attendance/screens/AttendanceScreen';

export const metadata: Metadata = { title: 'Attendance' };

export default function Page() {
  return <AttendanceScreen />;
}

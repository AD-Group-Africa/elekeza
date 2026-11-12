import type { Metadata } from 'next';
import StaffScreen from '@/features/admin/screens/StaffScreen';

export const metadata: Metadata = { title: 'Staff accounts' };

export default function Page() {
  return <StaffScreen />;
}

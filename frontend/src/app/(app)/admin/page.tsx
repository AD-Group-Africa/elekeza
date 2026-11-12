import type { Metadata } from 'next';
import SchoolAdminDashboardScreen from '@/features/admin/screens/SchoolAdminDashboardScreen';

export const metadata: Metadata = { title: 'School administration' };

export default function Page() {
  return <SchoolAdminDashboardScreen />;
}

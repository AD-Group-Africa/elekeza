import type { Metadata } from 'next';
import PlatformAdminScreen from '@/features/admin/screens/PlatformAdminScreen';

export const metadata: Metadata = { title: 'Platform administration' };

export default function Page() {
  return <PlatformAdminScreen />;
}

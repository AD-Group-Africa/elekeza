import type { Metadata } from 'next';
import EngagementScreen from '@/features/admin/screens/EngagementScreen';

export const metadata: Metadata = { title: 'Engagement' };

export default function Page() {
  return <EngagementScreen />;
}

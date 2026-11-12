import type { Metadata } from 'next';
import ReportsScreen from '@/features/guardian/screens/ReportsScreen';

export const metadata: Metadata = { title: 'Reports' };

export default function Page() {
  return <ReportsScreen />;
}

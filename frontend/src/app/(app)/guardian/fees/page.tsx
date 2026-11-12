import type { Metadata } from 'next';
import GuardianFeesScreen from '@/features/finance/screens/GuardianFeesScreen';

export const metadata: Metadata = { title: 'Fees' };

export default function Page() {
  return <GuardianFeesScreen />;
}

import type { Metadata } from 'next';
import FinanceScreen from '@/features/finance/screens/FinanceScreen';

export const metadata: Metadata = { title: 'Finance' };

export default function Page() {
  return <FinanceScreen />;
}

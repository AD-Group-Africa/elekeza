import type { Metadata } from 'next';
import SupportSignalsScreen from '@/features/teacher/screens/SupportSignalsScreen';

export const metadata: Metadata = { title: 'Support signals' };

export default function Page() {
  return <SupportSignalsScreen />;
}

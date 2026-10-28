import type { Metadata } from 'next';
import WardsScreen from '@/features/guardian/screens/WardsScreen';

export const metadata: Metadata = { title: 'My children' };

export default function Page() {
  return <WardsScreen />;
}

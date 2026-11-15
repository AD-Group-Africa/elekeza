import type { Metadata } from 'next';
import GuardianHomeScreen from '@/features/guardian/screens/GuardianHomeScreen';

export const metadata: Metadata = { title: 'Today' };

export default function Page() {
  return <GuardianHomeScreen />;
}

import type { Metadata } from 'next';
import WaitlistScreen from '@/features/waitlist/screens/WaitlistScreen';

export const metadata: Metadata = { title: 'Join the waitlist' };

export default function Page() {
  return <WaitlistScreen />;
}

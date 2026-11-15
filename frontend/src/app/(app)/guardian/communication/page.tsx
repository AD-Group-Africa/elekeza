import type { Metadata } from 'next';
import GuardianMessagesScreen from '@/features/messaging/screens/GuardianMessagesScreen';

export const metadata: Metadata = { title: 'Messages' };

export default function Page() {
  return <GuardianMessagesScreen />;
}

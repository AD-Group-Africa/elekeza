import type { Metadata } from 'next';
import TeacherMessagesScreen from '@/features/messaging/screens/TeacherMessagesScreen';

export const metadata: Metadata = { title: 'Messages' };

export default function Page() {
  return <TeacherMessagesScreen />;
}

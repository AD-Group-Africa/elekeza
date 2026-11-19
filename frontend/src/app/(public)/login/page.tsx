import type { Metadata } from 'next';
import LoginScreen from '@/features/auth/screens/LoginScreen';

export const metadata: Metadata = { title: 'Sign in' };

export default function Page() {
  return <LoginScreen />;
}

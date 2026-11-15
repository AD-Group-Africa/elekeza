import type { Metadata } from 'next';
import ResetPasswordScreen from '@/features/auth/screens/ResetPasswordScreen';

export const metadata: Metadata = { title: 'Reset password' };

export default function Page() {
  return <ResetPasswordScreen />;
}

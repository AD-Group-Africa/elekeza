import type { Metadata } from 'next';
import ForgotPasswordScreen from '@/features/auth/screens/ForgotPasswordScreen';

export const metadata: Metadata = { title: 'Forgot password' };

export default function Page() {
  return <ForgotPasswordScreen />;
}

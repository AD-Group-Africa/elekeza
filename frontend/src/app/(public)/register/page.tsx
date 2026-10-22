import type { Metadata } from 'next';
import RegisterScreen from '@/features/auth/screens/RegisterScreen';

export const metadata: Metadata = { title: 'Create an account' };

export default function Page() {
  return <RegisterScreen />;
}

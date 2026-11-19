import type { Metadata } from 'next';
import SchoolOnboardingScreen from '@/features/admin/screens/SchoolOnboardingScreen';

export const metadata: Metadata = { title: 'Register your school' };

export default function Page() {
  return <SchoolOnboardingScreen />;
}

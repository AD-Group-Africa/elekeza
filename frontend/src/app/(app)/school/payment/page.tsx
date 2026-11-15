import type { Metadata } from 'next';
import SubscriptionPaymentScreen from '@/features/finance/screens/SubscriptionPaymentScreen';

export const metadata: Metadata = { title: 'School subscription' };

export default function Page() {
  return <SubscriptionPaymentScreen />;
}

import type { Metadata } from 'next';
import WardDetailScreen from '@/features/guardian/screens/WardDetailScreen';

export const metadata: Metadata = { title: 'Learner details' };

export default function Page() {
  return <WardDetailScreen />;
}

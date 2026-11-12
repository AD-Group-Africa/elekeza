import type { Metadata } from 'next';
import { HeartHandshake } from 'lucide-react';
import { ComingSoon } from '@/components/ui';

export const metadata: Metadata = { title: 'Therapist portal' };

export default function Page() {
  return (
    <ComingSoon
      title="Therapist portal"
      description="Access learner profiles, design interventions, and track therapeutic progress."
      icon={<HeartHandshake size={48} />}
    />
  );
}

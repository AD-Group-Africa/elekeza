import { HeartHandshake } from 'lucide-react';
import ComingSoon from '@/components/ComingSoon';

export default function TherapistPortalPage() {
  return (
    <ComingSoon
      title="Therapist Portal"
      description="Access learner profiles, design interventions, and track therapeutic progress."
      icon={<HeartHandshake size={48} />}
    />
  );
}

import { Landmark } from 'lucide-react';
import ComingSoon from '@/components/ComingSoon';

export default function GovernmentPortalPage() {
  return (
    <ComingSoon
      title="Government Portal"
      description="County and national dashboards with anonymised learning analytics."
      icon={<Landmark size={48} />}
    />
  );
}

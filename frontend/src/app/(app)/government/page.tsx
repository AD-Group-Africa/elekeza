import type { Metadata } from 'next';
import { Landmark } from 'lucide-react';
import { ComingSoon } from '@/components/ui';

export const metadata: Metadata = { title: 'Government portal' };

export default function Page() {
  return (
    <ComingSoon
      title="Government portal"
      description="County and national dashboards with anonymised learning analytics."
      icon={<Landmark size={48} />}
    />
  );
}

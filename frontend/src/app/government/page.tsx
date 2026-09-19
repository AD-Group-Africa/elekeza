'use client';
import { HelpCircle } from 'lucide-react';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Government Portal"
      description="County and national dashboards with anonymised learning analytics."
      icon={<HelpCircle size={24} />}
    />
  );
}



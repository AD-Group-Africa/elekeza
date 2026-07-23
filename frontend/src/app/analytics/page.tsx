'use client';
import { AlertTriangle } from 'lucide-react';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Advanced Analytics"
      description="Deep insights into learner performance, engagement, and outcomes."
      icon={<AlertTriangle size={20} />}
    />
  );
}



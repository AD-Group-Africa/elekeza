'use client';
import { AlertTriangle } from 'lucide-react';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Resource Marketplace"
      description="Share and discover CBC-aligned lesson plans and teaching materials."
      icon={<AlertTriangle size={20} />}
    />
  );
}



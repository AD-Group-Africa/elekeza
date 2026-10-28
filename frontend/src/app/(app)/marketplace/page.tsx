import type { Metadata } from 'next';
import { Store } from 'lucide-react';
import { ComingSoon } from '@/components/ui';

export const metadata: Metadata = { title: 'Resource marketplace' };

export default function Page() {
  return (
    <ComingSoon
      title="Resource marketplace"
      description="Share and discover CBC-aligned lesson plans and teaching materials."
      icon={<Store size={48} />}
    />
  );
}

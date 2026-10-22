import type { Metadata } from 'next';
import { BookOpen } from 'lucide-react';
import { ComingSoon } from '@/components/ui';

export const metadata: Metadata = { title: 'Lesson plans' };

export default function Page() {
  return (
    <ComingSoon
      title="Lesson plans"
      description="Group lessons into saved, shareable lesson plans for each subject and term."
      icon={<BookOpen size={48} />}
    />
  );
}

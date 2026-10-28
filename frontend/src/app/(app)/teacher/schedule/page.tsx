import type { Metadata } from 'next';
import { Calendar } from 'lucide-react';
import { ComingSoon } from '@/components/ui';

export const metadata: Metadata = { title: 'Schedule & meetings' };

export default function Page() {
  return (
    <ComingSoon
      title="Schedule & meetings"
      description="Plan meetings and school events in a shared calendar. Your class timetable is already available under Timetable."
      icon={<Calendar size={48} />}
    />
  );
}

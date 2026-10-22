import { Calendar } from 'lucide-react';
import ComingSoon from '@/components/ComingSoon';

export default function TeacherSchedulePage() {
  return (
    <ComingSoon
      title="Schedule & Meetings"
      description="Plan meetings and school events in a shared calendar. Your class timetable is already available under Timetable."
      icon={<Calendar size={48} />}
    />
  );
}

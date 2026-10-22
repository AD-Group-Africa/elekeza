import { BookOpen } from 'lucide-react';
import ComingSoon from '@/components/ComingSoon';

export default function LessonPlansPage() {
  return (
    <ComingSoon
      title="Lesson Plans"
      description="Group lessons into saved, shareable lesson plans for each subject and term."
      icon={<BookOpen size={48} />}
    />
  );
}

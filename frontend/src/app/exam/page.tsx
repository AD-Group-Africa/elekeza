'use client';
import { AlertTriangle } from 'lucide-react';

import ComingSoon from '@/components/ComingSoon';

export default function Page() {
  return (
    <ComingSoon
      title="Exams & CBT"
      description="Timed assessments, question banks, auto-grading, and secure browser mode."
      icon={<AlertTriangle size={20} />}
    />
  );
}



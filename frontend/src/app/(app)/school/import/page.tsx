import type { Metadata } from 'next';
import StudentImportScreen from '@/features/admin/screens/StudentImportScreen';

export const metadata: Metadata = { title: 'Import learners' };

export default function Page() {
  return <StudentImportScreen />;
}

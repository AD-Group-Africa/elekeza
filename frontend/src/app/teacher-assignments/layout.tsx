import SidebarLayout from '@/components/layout/SidebarLayout';

/**
 * Wave 0 (UX-P1-01): teacher classwork is linked from the teacher navigation
 * but rendered without the shell that navigation belongs to.
 */
export default function TeacherAssignmentsLayout({ children }: { children: React.ReactNode }) {
  return <SidebarLayout>{children}</SidebarLayout>;
}

import SidebarLayout from '@/components/layout/SidebarLayout';

/**
 * Wave 0 (UX-P1-01): the attendance register rendered outside every layout, so
 * the sidebar and skip link disappeared as soon as a teacher opened it. The
 * shell is now owned by the route segment rather than by the page.
 */
export default function AttendanceLayout({ children }: { children: React.ReactNode }) {
  return <SidebarLayout>{children}</SidebarLayout>;
}

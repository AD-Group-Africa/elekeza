import SidebarLayout from '@/components/layout/SidebarLayout';

/**
 * Wave 0 (UX-P1-01): staff administration had no layout, so a school
 * administrator lost all navigation on the page where they manage accounts.
 */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <SidebarLayout>{children}</SidebarLayout>;
}

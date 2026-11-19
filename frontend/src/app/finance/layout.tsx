import SidebarLayout from '@/components/layout/SidebarLayout';

/**
 * Wave 0 (UX-P1-01): the finance dashboard is a 414-line operational surface
 * that rendered with no navigation at all.
 */
export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return <SidebarLayout>{children}</SidebarLayout>;
}

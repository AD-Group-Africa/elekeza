import SidebarLayout from '@/components/layout/SidebarLayout';

/**
 * Wave 0 (UX-P1-01): engagement analytics rendered outside every layout.
 */
export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <SidebarLayout>{children}</SidebarLayout>;
}

import SidebarLayout from '@/components/layout/SidebarLayout';

export default function GuardianLayout({ children }: { children: React.ReactNode }) {
  return <SidebarLayout>{children}</SidebarLayout>;
}

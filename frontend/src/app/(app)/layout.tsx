import AppShell from '@/components/layout/AppShell';

/** Every signed-in page shares the app shell (navigation + session guard). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

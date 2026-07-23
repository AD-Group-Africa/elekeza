import SidebarLayout from '@/components/layout/SidebarLayout';
import Link from 'next/link';

export default function NotFound() {
  return (
    <SidebarLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h1 className="text-6xl font-bold text-purple-400 mb-4">404</h1>
        <p className="text-xl text-purple-200 mb-6">This page doesn't exist yet.</p>
        <Link href="/" className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition">
          Take me home
        </Link>
      </div>
    </SidebarLayout>
  );
}

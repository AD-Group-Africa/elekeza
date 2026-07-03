'use client';
import SidebarLayout from '@/components/layout/SidebarLayout';

export default function Page() {
  return (
    <SidebarLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="card text-center max-w-md">
          <div className="text-5xl mb-4">🚀</div>
          <h2 className="text-2xl font-bold text-blue-900 mb-2">Coming Soon</h2>
          <p className="text-gray-600">This feature is being built to make Elekeza even better.</p>
        </div>
      </div>
    </SidebarLayout>
  );
}

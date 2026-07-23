'use client';
import { Clock } from 'lucide-react';

import SidebarLayout from '@/components/layout/SidebarLayout';

export default function ComingSoon({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <SidebarLayout>
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <div className="text-6xl mb-6">{icon}</div>
        <h1 className="text-4xl font-bold text-white mb-4">{title}</h1>
        <p className="text-lg text-gray-300 max-w-md mb-8">{description}</p>
        <div className="bg-white/10 backdrop-blur rounded-xl px-6 py-3 text-white/80 text-sm font-medium">
          <Clock size={20} className="inline mr-2" /> Coming Soon
        </div>
      </div>
    </SidebarLayout>
  );
}


import type { ReactNode } from 'react';
import { Clock } from 'lucide-react';

/**
 * Placeholder for planned features. Honest by design: no fake data, no
 * controls that pretend to work. Render it inside a layout (e.g. SidebarLayout).
 */
export default function ComingSoon({ title, description, icon }: { title: string; description: string; icon: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="mb-6 text-purple-300" aria-hidden="true">{icon}</div>
      <h1 className="text-3xl font-bold text-purple-100 mb-4">{title}</h1>
      <p className="text-lg text-purple-300 max-w-md mb-8">{description}</p>
      <div className="bg-white/10 rounded-xl px-6 py-3 text-purple-200 text-sm font-medium">
        <Clock size={20} className="inline mr-2" aria-hidden="true" /> Coming soon
      </div>
    </div>
  );
}

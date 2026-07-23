'use client';

import { useAuth } from '@/hooks/useAuth';
import Image from 'next/image';
import Link from 'next/link';

export default function AppBar() {
  const { user, logout } = useAuth();

  return (
    <header className="w-full flex items-center justify-between px-6 py-3 bg-transparent">
      <Link href="/dashboard">
        <Image
          src="/Elekeza Logo.png"
          alt="Elekeza"
          width={120}
          height={40}
          priority
        />
      </Link>
      <div className="flex items-center gap-4">
        <span className="text-white text-sm hidden md:block">
          {user?.name || 'Learner'}
        </span>
        <button
          onClick={logout}
          className="text-white text-sm opacity-70 hover:opacity-100 transition"
        >
          Logout
        </button>
      </div>
    </header>
  );
}


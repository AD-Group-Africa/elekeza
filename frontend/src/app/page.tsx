'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-gray-900">
      <h1 className="text-5xl font-serif font-bold text-white">Elekeza</h1>
      <p className="text-lg text-purple-200 mt-2">Where learning finds direction</p>
      <div className="mt-6 w-6 h-6 border-2 border-purple-300 border-t-transparent rounded-full animate-spin"></div>
    </main>
  );
}

'use client';

import Image from 'next/image';

export default function LessonLoading() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-indigo-500">
      <Image
        src="/Elekeza Logo.png"
        alt="Elekeza"
        width={150}
        height={50}
        className="mb-8"
      />
      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-white"></div>
      <p className="mt-4 text-white text-lg">Loading lesson...</p>
    </main>
  );
}

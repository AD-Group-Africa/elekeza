import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <p className="text-6xl font-bold text-purple-400 mb-4">404</p>
      <h1 className="text-xl text-purple-200 mb-6">This page doesn&apos;t exist.</h1>
      <Link href="/" className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition">
        Take me home
      </Link>
    </main>
  );
}

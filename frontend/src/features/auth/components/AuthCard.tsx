import type { ReactNode } from 'react';
import Image from 'next/image';

/** Centered card frame shared by the sign-in, sign-up and password pages. */
export function AuthCard({
  title,
  subtitle,
  withLogo = false,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  withLogo?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="glass-card w-full max-w-md p-8">
        {withLogo ? (
          <>
            <Image
              src="/Elekeza Logo.png"
              alt="Elekeza"
              width={260}
              height={260}
              priority
              className="mx-auto h-auto w-auto max-w-[240px] object-contain"
            />
            <h1 className="mb-6 text-center text-xl font-semibold text-purple-200">{title}</h1>
          </>
        ) : (
          <h1 className="mb-2 text-center text-3xl font-bold text-purple-200">{title}</h1>
        )}
        {subtitle && <p className="mb-6 text-center text-sm text-purple-300">{subtitle}</p>}
        {children}
      </div>
      <p className="mt-8 text-center text-xs text-purple-200/50">
        &copy; {new Date().getFullYear()} Elekeza. All rights reserved.
      </p>
    </main>
  );
}

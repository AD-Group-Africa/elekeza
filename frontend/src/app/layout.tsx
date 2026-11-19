import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/providers/AppProviders';
import { ROLE_PALETTE_STORAGE_KEY, SETTINGS_STORAGE_KEY } from '@/lib/storageKeys';
import { DEFAULT_ROLE_PALETTE, ROLE_PALETTES } from '@/features/accessibility/rolePalette';

export const metadata: Metadata = {
  title: { default: 'Elekeza', template: '%s · Elekeza' },
  description: 'Where learning finds direction',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Elekeza',
  },
};

// Applies the saved theme before first paint so light/calm users never see a
// dark flash. Mirrors resolveTheme() in features/accessibility.
// it also restores the last role colour family (data-role) so reloads and
// public pages keep the right palette; RolePaletteSync takes over after sign-in.
const THEME_BOOTSTRAP = `try{var d=document.documentElement;var s=JSON.parse(localStorage.getItem('${SETTINGS_STORAGE_KEY}')||'{}');d.setAttribute('data-theme',s.calmMode?'calm':s.lightTheme?'light':'dark');var r=localStorage.getItem('${ROLE_PALETTE_STORAGE_KEY}');if(${JSON.stringify(ROLE_PALETTES)}.indexOf(r)>-1)d.setAttribute('data-role',r)}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" data-role={DEFAULT_ROLE_PALETTE} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

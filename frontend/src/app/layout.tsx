import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { AccessibilitySettingsProvider } from "@/hooks/useAccessibilitySettings";
import { SETTINGS_STORAGE_KEY } from "@/lib/storageKeys";
import { CognitiveProfileProvider } from "@/hooks/useCognitiveProfile";

export const metadata: Metadata = {
  title: "Elekeza",
  description: "Where learning finds direction",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Elekeza",
  },
};

// Applies the saved theme before first paint so light/calm users never see a
// dark flash. Mirrors resolveTheme() in useAccessibilitySettings.
const THEME_BOOTSTRAP = `try{var s=JSON.parse(localStorage.getItem('${SETTINGS_STORAGE_KEY}')||'{}');document.documentElement.setAttribute('data-theme',s.calmMode?'calm':s.lightTheme?'light':'dark')}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <CognitiveProfileProvider>
            <AccessibilitySettingsProvider>
              {children}
            </AccessibilitySettingsProvider>
          </CognitiveProfileProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

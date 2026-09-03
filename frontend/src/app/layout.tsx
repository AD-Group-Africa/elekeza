import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { AccessibilitySettingsProvider } from "@/hooks/useAccessibilitySettings";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark">
      <body
        className="antialiased"
      >
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





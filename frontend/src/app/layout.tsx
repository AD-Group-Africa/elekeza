import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { AccessibilitySettingsProvider } from "@/hooks/useAccessibilitySettings";
import { CognitiveProfileProvider } from "@/hooks/useCognitiveProfile";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

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
    <html lang="en">
      <body
        style={{
          background: "linear-gradient(135deg, #1E3A8A 0%, #FFFFFF 50%, #4F46E5 100%)",
          minHeight: "100vh",
          margin: 0,
          padding: 0,
          fontFamily: "var(--font-inter), system-ui, sans-serif",
        }}
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

import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Nunito } from "next/font/google";
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

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
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
    <html lang="en" data-theme="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${nunito.variable} antialiased`}
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





import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import AppHeader from "@/components/AppHeader";
import FrontendErrorTracker from "@/components/FrontendErrorTracker";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AOP",
  description: "A public claim forum for protocols, consensus, and calibration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${sora.variable} antialiased`}>
        <ConvexClientProvider>
          <FrontendErrorTracker />
          <div className="min-h-screen text-[var(--ink)]">
            <AppHeader />
            {children}
          </div>
        </ConvexClientProvider>
      </body>
    </html>
  );
}

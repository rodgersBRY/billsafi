import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { introSplashBootScript } from "@/components/brand/intro-splash";
import { themeBootScript } from "@/lib/theme-boot";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BillSafi",
  description: "Invoicing for freelancers and independent professionals.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The boot scripts may set data-intro and data-theme before hydration.
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col font-sans">
        <Script id="intro-splash-boot" strategy="beforeInteractive">
          {introSplashBootScript}
        </Script>
        <Script id="theme-boot" strategy="beforeInteractive">
          {themeBootScript}
        </Script>
        {children}
      </body>
    </html>
  );
}

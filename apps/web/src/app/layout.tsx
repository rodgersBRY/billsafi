import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { introSplashBootScript } from "@/components/brand/intro-splash";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Billsafi",
  description: "Invoicing for Kenyan freelancers and independent professionals.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The intro boot script may set data-intro before hydration.
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col font-sans">
        <Script id="intro-splash-boot" strategy="beforeInteractive">
          {introSplashBootScript}
        </Script>
        {children}
      </body>
    </html>
  );
}

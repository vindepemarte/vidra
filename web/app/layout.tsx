import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";

import { CookieBanner } from "@/components/cookie-banner";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";

const headingFont = Sora({ subsets: ["latin"], variable: "--font-heading" });
const bodyFont = Manrope({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Vidra by Lexa AI",
  description: "Vidra by Lexa AI is the operating system for AI influencer creators."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${headingFont.variable} ${bodyFont.variable} site-surface`}>
        <Providers>
          {children}
          <SiteFooter />
          <CookieBanner />
        </Providers>
      </body>
    </html>
  );
}

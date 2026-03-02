import type { Metadata } from "next";
import { Orbitron, Space_Grotesk } from "next/font/google";
import "./globals.css";

import { Providers } from "@/components/providers";

const headingFont = Orbitron({ subsets: ["latin"], variable: "--font-heading" });
const bodyFont = Space_Grotesk({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Vidra",
  description: "AI influencer operating system"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${headingFont.variable} ${bodyFont.variable} grid-noise`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter, Fira_Code } from "next/font/google";
import TauriGuard from "@/components/TauriGuard";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pantheon Forge - AI Agent Platform",
  description: "Summon specialized AI agents at will",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${firaCode.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="min-h-full flex flex-col bg-surface-primary text-text-primary scanlines">
        <TauriGuard>{children}</TauriGuard>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import TauriGuard from '@/components/TauriGuard';
import './globals.css';

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
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="min-h-full flex flex-col bg-surface-primary text-text-primary scanlines">
        <TauriGuard>{children}</TauriGuard>
      </body>
    </html>
  );
}

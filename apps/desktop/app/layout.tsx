import type { Metadata } from 'next';
import TauriGuard from '@/components/TauriGuard';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pantheon Forge',
  description: 'Unified agent command deck for specialist AI workflows',
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: '/brand/pantheon-forge-mark.svg', type: 'image/svg+xml' },
      { url: '/brand/pantheon-forge-mark.png', type: 'image/png' },
    ],
    apple: [{ url: '/brand/pantheon-forge-mark.png', type: 'image/png' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-surface-primary text-text-primary scanlines">
        <TauriGuard>{children}</TauriGuard>
      </body>
    </html>
  );
}

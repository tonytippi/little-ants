import type { Metadata, Viewport } from 'next';
import { Andika, Nunito } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';

const nunito = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-nunito' });
const andika = Andika({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '700'],
  variable: '--font-andika',
});

export const metadata: Metadata = {
  title: { default: 'Little Ants Teacher', template: '%s · Little Ants Teacher' },
  description: 'Prepare and teach Little Ants English lessons, online or offline.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Little Ants', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#2e7d32',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} ${andika.variable}`}>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

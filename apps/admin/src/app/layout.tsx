import type { Metadata } from 'next';
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
  title: { default: 'Little Ants Admin', template: '%s · Little Ants Admin' },
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
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

import type { Metadata, Viewport } from 'next';
import { Andika, Baloo_2, Poppins } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';

const poppins = Poppins({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
});
const andika = Andika({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '700'],
  variable: '--font-andika',
});
const baloo = Baloo_2({ subsets: ['latin', 'vietnamese'], weight: ['700', '800'], variable: '--font-baloo' });

export const metadata: Metadata = {
  title: { default: 'Little Ants Listening', template: '%s · Little Ants Listening' },
  description: 'Listening Time: the songs, stories and rhymes of Little Ants English, a few minutes a day.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Listening', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#4f7f32',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${andika.variable} ${baloo.variable}`}>
      <body className="min-h-dvh text-[15px] leading-normal antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

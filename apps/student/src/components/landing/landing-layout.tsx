import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { andika } from '@little-ants/ui/lib/font-andika';
import { baloo } from '@little-ants/ui/lib/font-baloo';
import { poppins } from '@little-ants/ui/lib/font-poppins';
import { LANDING_COPY, type Lang } from './landing-copy';
import { LANDING_SCRIPT } from './landing-script';

const SITE_URL = process.env.NEXT_PUBLIC_STUDENT_APP_URL ?? 'http://localhost:3003';

export const landingViewport: Viewport = { themeColor: '#4f7f32', width: 'device-width', initialScale: 1 };

export function landingMetadata(lang: Lang): Metadata {
  const copy = LANDING_COPY[lang];
  const path = lang === 'vi' ? '/' : '/en';
  return {
    metadataBase: new URL(SITE_URL),
    title: copy.title,
    description: copy.description,
    manifest: '/manifest.webmanifest',
    icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
    alternates: { canonical: path, languages: { vi: '/', en: '/en', 'x-default': '/' } },
    openGraph: {
      type: 'website',
      url: path,
      siteName: 'Little Ants English',
      title: copy.title,
      description: copy.description,
      locale: lang === 'vi' ? 'vi_VN' : 'en_US',
      images: [{ url: '/landing/og-image.jpg', width: 1200, height: 630 }],
    },
  };
}

/** The root document of a landing page (one per language, so <html lang> is right without JavaScript). */
export function LandingDocument({ lang, children }: { lang: Lang; children: ReactNode }) {
  return (
    <html lang={lang} className={`${poppins.variable} ${andika.variable} ${baloo.variable}`}>
      {/* eslint-disable-next-line @next/next/no-head-element -- an App Router root layout owns <head>; the script must run before paint */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: LANDING_SCRIPT }} />
      </head>
      <body className="text-[15px] leading-normal antialiased">{children}</body>
    </html>
  );
}

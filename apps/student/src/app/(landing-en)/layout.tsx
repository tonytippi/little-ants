import type { ReactNode } from 'react';
import { LandingDocument, landingMetadata, landingViewport } from '../../components/landing/landing-layout';
import '../globals.css';

export const metadata = landingMetadata('en');
export const viewport = landingViewport;

export default function EnglishLandingLayout({ children }: { children: ReactNode }) {
  return <LandingDocument lang="en">{children}</LandingDocument>;
}

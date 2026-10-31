import type { ReactNode } from 'react';
import { LandingDocument, landingMetadata, landingViewport } from '../../components/landing/landing-layout';
import '../globals.css';

export const metadata = landingMetadata('vi');
export const viewport = landingViewport;

export default function VietnameseLandingLayout({ children }: { children: ReactNode }) {
  return <LandingDocument lang="vi">{children}</LandingDocument>;
}

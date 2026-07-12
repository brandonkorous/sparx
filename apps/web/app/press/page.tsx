import type { Metadata } from 'next';
import { ComingSoon } from '@/components/marketing/coming-soon';

export const metadata: Metadata = {
  title: 'Press — sparx',
  description: 'Press inquiries, founder bio, brand assets, hi-res screenshots.',
  alternates: { canonical: '/press' },
  robots: { index: false },
};

export default function PressPage() {
  return (
    <ComingSoon
      eyebrow="Company"
      title="Press"
      description="Press inquiries, founder bio, brand assets, hi-res screenshots, and the latest sparx announcements. We respond within one business day."
      contact="press@sparx.works"
    />
  );
}

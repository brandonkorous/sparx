import type { Metadata } from 'next';
import { ComingSoon } from '@/components/marketing/coming-soon';

export const metadata: Metadata = {
  title: 'Contact — sparx',
  description:
    'Sales, support, partnerships, press. Pick the right address or just write hello@sparx.works.',
  alternates: { canonical: '/contact' },
  robots: { index: false },
};

export default function ContactPage() {
  return (
    <ComingSoon
      eyebrow="Company"
      title="Contact"
      description="Sales (sales@), enterprise (enterprise@), press (press@), security (security@), or just hello@sparx.works for anything else. A real human reads every message. We answer within one business day."
      contact="hello@sparx.works"
    />
  );
}

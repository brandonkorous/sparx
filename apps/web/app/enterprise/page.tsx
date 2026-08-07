import type { Metadata } from 'next';
import { ComingSoon } from '@/components/marketing/coming-soon';

export const metadata: Metadata = {
  title: 'Enterprise — sparx',
  description:
    'Custom sites, dedicated support, security review assistance, contract terms tailored to your security and procurement requirements.',
  alternates: { canonical: '/enterprise' },
  robots: { index: false },
};

export default function EnterprisePage() {
  return (
    <ComingSoon
      eyebrow="Platform"
      title="Enterprise"
      description="Custom sites, dedicated support, security review assistance, 99.99% SLA with credits, and contract terms tailored to your security and procurement process."
      contact="enterprise@sparx.works"
    />
  );
}

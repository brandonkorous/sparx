import type { Metadata } from 'next';
import { PricingPage } from '@/components/marketing/pricing-page';

export const metadata: Metadata = {
  title: 'Pricing — sparx',
  description:
    'Per-module pricing — switch on only what you use, from $10/mo. One platform, one invoice, a 14-day free trial with no card to start. See what each module replaces and what you keep.',
  alternates: { canonical: '/pricing' },
};

export default function Pricing() {
  return <PricingPage />;
}

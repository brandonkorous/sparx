import type { Metadata } from 'next';
import { CustomersPage } from '@/components/marketing/customers-page';

export const metadata: Metadata = {
  title: 'Who runs on sparx',
  description:
    'Publishers, retailers, distributors, agencies, AI-first teams — each turns on the modules they need, on one bill. See the flagship Gillett Diesel build.',
  alternates: { canonical: '/customers' },
  // Per-page og:url — see app/pricing/page.tsx for why inheriting the layout's
  // site-root url breaks LinkedIn share de-duplication.
  openGraph: {
    title: 'Who runs on sparx',
    description:
      'Publishers, retailers, distributors, agencies, AI-first teams — each turns on the modules they need, on one bill.',
    url: 'https://sparx.works/customers',
  },
};

export default function Customers() {
  return <CustomersPage />;
}

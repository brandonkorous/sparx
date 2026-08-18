import type { Metadata } from 'next';
import { CustomersPage } from '@/components/marketing/customers-page';

export const metadata: Metadata = {
  title: 'Whatever it is you run — sparx for your kind of business',
  description:
    'Salons, auto shops, tattoo studios, restaurants, trades and independent retail. Twelve separate parts; switch on the ones your week needs. See what a business like yours actually pays.',
  alternates: { canonical: '/customers' },
  // Per-page og:url — see app/pricing/page.tsx for why inheriting the layout's
  // site-root url breaks LinkedIn share de-duplication.
  openGraph: {
    title: 'Whatever it is you run — sparx for your kind of business',
    description:
      'Salons, auto shops, tattoo studios, restaurants, trades and independent retail. Switch on the parts your week needs and pay for nothing else.',
    url: 'https://sparx.works/customers',
  },
};

export default function Customers() {
  return <CustomersPage />;
}

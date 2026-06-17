import type { Metadata } from 'next';
import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { CustomersPage } from '@/components/marketing/customers-page';

export const metadata: Metadata = {
  title: 'Customers — sparx',
  description:
    'Who builds on sparx — publishers, retailers, wholesale distributors, agencies, and AI-first teams. Each turns on the modules they need, on one bill. See the flagship Gillett Diesel build.',
  alternates: { canonical: '/customers' },
};

export default function Customers() {
  return (
    <>
      <Nav />
      <CustomersPage />
      <Footer />
    </>
  );
}

import type { Metadata } from 'next';
import { MigrateHub } from '@/components/marketing/migrate/migrate-hub';

/**
 * `/migrate` — the switching hub.
 *
 * This route previously shipped a `<ComingSoon>` stub, `robots: { index: false }`,
 * that advertised Shopify, HubSpot, Mailchimp and WordPress importers which did not
 * exist. It is now indexable because the thing it describes is real, and the list of
 * platforms on it is generated from the adapter registry rather than typed by hand —
 * so the claim and the capability cannot come apart again.
 */
export const metadata: Metadata = {
  title: 'Switch to sparx — bring your business over in an afternoon',
  description:
    'Move your products, customers, stock, orders and writing from Shopify, Squarespace, Wix, Webflow, WordPress, HubSpot and a dozen more. Read what will happen before anything is saved.',
  keywords: [
    'migrate to sparx',
    'switch ecommerce platform',
    'shopify alternative',
    'wordpress alternative',
    'hubspot alternative',
    'import products csv',
  ],
  alternates: { canonical: '/migrate' },
  openGraph: {
    title: 'Switch to sparx — bring your business over in an afternoon',
    description:
      'Products, customers, stock, orders and everything you have written, from the export file your current platform already makes.',
    url: 'https://sparx.works/migrate',
    siteName: 'sparx',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Switch to sparx — bring your business over in an afternoon',
    description:
      'Products, customers, stock, orders and everything you have written, from the export file your current platform already makes.',
  },
};

export default function MigratePage() {
  return <MigrateHub />;
}

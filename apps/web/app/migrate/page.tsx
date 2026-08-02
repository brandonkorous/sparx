import type { Metadata } from 'next';
import { ComingSoon } from '@/components/marketing/coming-soon';

export const metadata: Metadata = {
  title: 'Migration tools — sparx',
  description:
    'Native importers for Shopify, HubSpot, Mailchimp, and WordPress. Most small-business migrations finish in under a week; a complex B2B move with custom checkout work runs about two.',
  alternates: { canonical: '/migrate' },
  robots: { index: false },
};

export default function MigratePage() {
  return (
    <ComingSoon
      eyebrow="Platform"
      title="Migration tools"
      description="Native importers for Shopify (products, customers, orders, themes), HubSpot (contacts, deals, lists), Mailchimp (audiences, automations), and WordPress (posts, media, redirects). Most SMB migrations finish in under a week."
      contact="migrate@sparx.works"
    />
  );
}

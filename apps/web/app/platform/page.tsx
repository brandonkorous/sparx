import type { Metadata } from 'next';
import { PlatformPage } from '@/components/marketing/platform-page';

export const metadata: Metadata = {
  title: 'Platform — sparx',
  description:
    'One platform for content and commerce. Twelve modules on one shared data layer, one dashboard, one bill — API-first and MCP-native. Activate only what you need.',
  alternates: { canonical: '/platform' },
  // Per-page og:url — see app/pricing/page.tsx for why inheriting the layout's
  // site-root url breaks LinkedIn share de-duplication.
  openGraph: {
    title: 'Platform — sparx',
    description:
      'One platform for content and commerce. Twelve modules on one shared data layer, one dashboard, one bill — API-first and MCP-native.',
    url: 'https://sparx.works/platform',
  },
};

export default function Platform() {
  return <PlatformPage />;
}

import type { Metadata } from 'next';
import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { PlatformPage } from '@/components/marketing/platform-page';

export const metadata: Metadata = {
  title: 'Platform — sparx',
  description:
    'One platform for content and commerce. Eight modules on one shared data layer, one dashboard, one bill — API-first and MCP-native. Activate only what you need.',
  alternates: { canonical: '/platform' },
};

export default function Platform() {
  return (
    <>
      <Nav />
      <PlatformPage />
      <Footer />
    </>
  );
}

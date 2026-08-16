import type { Metadata } from 'next';
import { PRODUCT } from '@piggles/config';
import { ToolsIndex } from '@/components/marketing/tools/tools-index';
import { TOOLS } from '@/components/marketing/tools/registry';

const DESCRIPTION =
  'Seventeen free tools that run in your browser — a favicon maker, QR codes, invoices and quotes, a pricing calculator, colour palettes, and the SEO bits nobody explains. No sign-up, no watermark, nothing uploaded.';

export const metadata: Metadata = {
  title: 'Free tools for small businesses',
  description: DESCRIPTION,
  keywords: [
    'free business tools',
    'free invoice generator',
    'favicon generator',
    'qr code generator',
    'free quote template',
    'margin calculator',
    ...TOOLS.flatMap((t) => t.keywords).slice(0, 14),
  ],
  alternates: { canonical: '/tools' },
  openGraph: {
    title: `Free tools for small businesses · ${PRODUCT.name}`,
    description: DESCRIPTION,
    url: `https://${PRODUCT.hosts.marketing}/tools`,
    siteName: PRODUCT.name,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Free tools for small businesses · ${PRODUCT.name}`,
    description:
      'Invoices, QR codes, favicons, quotes, pricing sums and more. Free, in your browser, no sign-up.',
  },
};

export default function ToolsPage() {
  return <ToolsIndex />;
}

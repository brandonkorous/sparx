import type { Metadata } from 'next';
import { ToolsIndex } from '@/components/marketing/tools/tools-index';
import { TOOLS } from '@/components/marketing/tools/registry';

const DESCRIPTION =
  'Free, browser-based tools for founders and small teams — a favicon generator, QR code maker, UTM link builder, Open Graph image maker, email signature generator, and invoice generator. Every tool runs entirely in your browser: nothing is uploaded, no sign-up, no watermark.';

export const metadata: Metadata = {
  title: 'Free tools for builders & businesses',
  description: DESCRIPTION,
  keywords: [
    'free business tools',
    'favicon generator',
    'qr code generator',
    'utm builder',
    'open graph image generator',
    'email signature generator',
    'invoice generator',
    ...TOOLS.flatMap((t) => t.keywords).slice(0, 12),
  ],
  alternates: { canonical: '/tools' },
  openGraph: {
    title: 'Free tools for builders & businesses · sparx',
    description: DESCRIPTION,
    url: 'https://sparx.works/tools',
    siteName: 'sparx',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free tools for builders & businesses · sparx',
    description:
      'Favicons, QR codes, UTM links, social cards, email signatures, invoices — free, in your browser.',
  },
};

export default function ToolsPage() {
  return <ToolsIndex />;
}

import type { Metadata } from 'next';
import { ToolsIndex } from '@/components/marketing/tools/tools-index';
import { TOOLS } from '@/components/marketing/tools/registry';

const DESCRIPTION =
  'Free tools that run in your browser — favicon and QR code generators, a UTM builder, OG image maker, email signatures, and invoices. No upload. No sign-up.';

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
    description:
      'Favicons, QR codes, UTM links, social cards, email signatures, invoices — and more. Free, in your browser. Nothing uploaded, no account, no watermark.',
    url: 'https://sparx.works/tools',
    siteName: 'sparx',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free tools for builders & businesses · sparx',
    description:
      'Favicons, QR codes, UTM links, invoices, and more. Free, in your browser. No sign-up.',
  },
};

export default function ToolsPage() {
  return <ToolsIndex />;
}

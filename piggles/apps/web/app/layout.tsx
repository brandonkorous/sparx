import type { Metadata } from 'next';
import { Fredoka, Inter } from 'next/font/google';
import { PRODUCT } from '@piggles/config';
import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import './globals.css';

// Self-hosted at build time by next/font — no request leaves the page, so there
// is no third-party font host to consent to and nothing to block the first
// paint. Both carry the `variable` option; globals.css re-points --font-sans and
// --font-heading at the hashed families these generate.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// The display face. Variable, not a weight list: Fredoka's wght axis stops at
// 700, so `font-extrabold` and `font-black` clamp there rather than erroring.
const fredoka = Fredoka({
  subsets: ['latin'],
  variable: '--font-fredoka',
  display: 'swap',
});

export const metadata: Metadata = {
  // Required for social cards to work at all: without it, `opengraph-image`
  // resolves to a RELATIVE URL, which every scraper rejects — the card silently
  // does not appear and nothing anywhere reports an error. Built from
  // PRODUCT.hosts rather than a literal so the three surfaces cannot drift.
  metadataBase: new URL(`https://${PRODUCT.hosts.marketing}`),
  title: {
    default: PRODUCT.name,
    template: `%s · ${PRODUCT.name}`,
  },
  description: PRODUCT.tagline,
  openGraph: {
    type: 'website',
    siteName: PRODUCT.name,
    locale: 'en_US',
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `light` is the BARE silicaui theme name, and it is the Piggles brand here
    // because this app never loads @sparx/brand/theme.css. See globals.css.
    <html lang="en" data-theme="light" className={`${inter.variable} ${fredoka.variable}`}>
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

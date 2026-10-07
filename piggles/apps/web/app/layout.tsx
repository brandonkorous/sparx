import type { Metadata } from 'next';
import { Fredoka, Inter } from 'next/font/google';
import { fetchHeaderNotice, PRODUCT } from '@piggles/config';
import { fetchFounderOffer, founderNotice } from '@piggles/config/pricing';
import { HeaderNotice } from '@piggles/ui';
import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { THEME_SCRIPT } from '@/lib/theme';
import { ConsentBar } from '@/components/consent-bar';
import { AttributionCapture } from '@/components/attribution-capture';
import { PostHogProvider } from '@/components/posthog-provider';
import './globals.css';

// Self-hosted by next/font: no third-party font host to consent to. globals.css
// points --font-sans and --font-heading at the families these generate.
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
  // Without it `opengraph-image` resolves RELATIVE and every scraper silently
  // drops the card.
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

// The bar: whatever staff have switched on, else the founding offer while places
// are left. Both are cached a minute and NEVER throw; the worst case is no bar.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const notice =
    (await fetchHeaderNotice('marketing')) ??
    founderNotice(await fetchFounderOffer(), '/pricing#founding');

  return (
    // NO `data-theme`: THEME_SCRIPT is its one writer, and a React default would
    // race it. `suppressHydrationWarning` is the counterpart, for that attribute.
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${fredoka.variable}`}>
      <head>
        {/* Blocking in <head>, so the theme lands before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {/* Above everything that might capture; initialises nothing until consent. */}
        <PostHogProvider>
          {/* Above the header, so switching a notice on never moves the site's chrome. */}
          <HeaderNotice notice={notice} />
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
          {/* The one question this site asks. Renders nothing once answered. */}
          <ConsentBar />
          {/* Where a visit came from (with permission), handed over on signup. */}
          <AttributionCapture />
        </PostHogProvider>
      </body>
    </html>
  );
}

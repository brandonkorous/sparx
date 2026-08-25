import type { Metadata } from 'next';
import { Fredoka, Inter } from 'next/font/google';
import { fetchHeaderNotice, PRODUCT } from '@piggles/config';
import { HeaderNotice } from '@piggles/ui';
import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { THEME_SCRIPT } from '@/lib/theme';
import { ConsentBar } from '@/components/consent-bar';
import { AttributionCapture } from '@/components/attribution-capture';
import { PostHogProvider } from '@/components/posthog-provider';
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

// `async`, for one fetch: what WizeWorks is announcing today. It is cached for a
// minute and NEVER throws (see `fetchHeaderNotice`), so the site does not depend
// on the announcement service being up — the worst case is no bar.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const notice = await fetchHeaderNotice('marketing');

  return (
    // NO `data-theme` here. It carried a hardcoded `light` as "the SSR default,
    // not the answer" — but React owns every attribute it renders and re-asserts
    // it whenever the element is created, so the default was a SECOND writer
    // racing THEME_SCRIPT, able to put a dark visitor back on white after the
    // script had already decided otherwise. lib/theme.ts says it plainly: the
    // script is the one place allowed to write this attribute, and one writer is
    // the only arrangement that cannot disagree with itself.
    //
    // `suppressHydrationWarning` is its counterpart and is scoped to this
    // element: by the time React hydrates, the attribute the script added was
    // never in the markup React was sent, and that is the whole point rather
    // than a bug to report. (`light` and `dark` are the bare silicaui theme
    // names, and they are the Piggles brand here because this app never loads
    // @sparx/brand/theme.css. See globals.css.)
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${fredoka.variable}`}>
      <head>
        {/* In <head> and blocking, so it lands before anything is painted. An
            effect, a provider or a server-read cookie are all later than the
            first frame, which is the one frame this exists to fix. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {/* Wraps the page rather than sitting beside it, because PostHog's React
            context has to be above anything that might capture from a component.
            It initialises NOTHING until the consent bar below is accepted — see
            the file header. */}
        <PostHogProvider>
          {/* ABOVE the header, not inside it. A notice is temporary and the header
              is not; nesting it would make the site's own chrome jump every time
              somebody in the admin console switches one on. */}
          <HeaderNotice notice={notice} />
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
          {/* The one question this site asks. Renders nothing once answered. */}
          <ConsentBar />
          {/* Records where a visit came from — only with permission — and hands it
              to getpiggles.com on the signup click. Renders nothing, ever. */}
          <AttributionCapture />
        </PostHogProvider>
      </body>
    </html>
  );
}

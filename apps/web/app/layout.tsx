import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Inter } from 'next/font/google';
import { ChunkReloadGuard, Toaster } from '@sparx/ui';
import { PostHogProvider } from '../components/posthog-provider';
import { TopProgressBar } from '../components/top-progress-bar';
import { AttributionCapture } from '../components/attribution-capture';
import { ConsentBanner } from '../components/consent-banner';
import { Nav } from '../components/marketing/nav';
import { Footer } from '../components/marketing/footer';

// Inter powers the sparx wordmark (bold, to match the monogram mark). Exposed
// as --font-wordmark, which @sparx/ui's <Wordmark> consumes.
const interWordmark = Inter({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-wordmark',
  display: 'swap',
});
import './globals.css';
import './marketing.css';

const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'WizeWorks, Inc.',
  url: 'https://wize.works',
  logo: 'https://sparx.works/icon.png',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Visalia',
    addressRegion: 'CA',
    addressCountry: 'US',
  },
  brand: {
    '@type': 'Brand',
    name: 'sparx',
    url: 'https://sparx.works',
  },
  sameAs: ['https://wize.works', 'https://sparx.works'],
};

const PRODUCT_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'sparx',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'A modular content and commerce operating system. Builder, CRM, CMS, email, B2B, and AI — one platform, one bill, one data layer.',
  offers: {
    '@type': 'Offer',
    price: '10',
    priceCurrency: 'USD',
  },
  url: 'https://sparx.works',
  publisher: {
    '@type': 'Organization',
    name: 'WizeWorks, Inc.',
    url: 'https://wize.works',
  },
};

// WebSite entity (docs/50) — names the site as a whole so search/answer engines
// can attribute pages and the brand. No SearchAction: the marketing site has no
// public search URL, and a SearchAction pointing at a non-existent endpoint is
// worse than omitting it.
const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'sparx',
  url: 'https://sparx.works',
  publisher: {
    '@type': 'Organization',
    name: 'WizeWorks, Inc.',
    url: 'https://wize.works',
  },
};

export const metadata: Metadata = {
  title: 'sparx — Everything, ignited.',
  description:
    'A modular content and commerce operating system. Builder, CRM, CMS, email, B2B, and AI — one platform, one bill, one data layer. Pay only for what you use. Live in five minutes.',
  metadataBase: new URL('https://sparx.works'),
  alternates: {
    canonical: '/',
  },
  // OG + Twitter images are generated dynamically from app/opengraph-image.tsx
  // and app/twitter-image.tsx — Next auto-discovers them.
  openGraph: {
    title: 'sparx — Everything, ignited.',
    description:
      'Modular content and commerce OS by WizeWorks. Twelve modules, one platform, MCP-native AI. Live in five minutes.',
    url: 'https://sparx.works',
    siteName: 'sparx',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'sparx — Everything, ignited.',
    description: 'Modular content and commerce OS by WizeWorks.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  applicationName: 'sparx',
  authors: [{ name: 'WizeWorks, Inc.', url: 'https://wize.works' }],
  creator: 'WizeWorks, Inc.',
  publisher: 'WizeWorks, Inc.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${interWordmark.variable}`}
    >
      <head>
        {/* Adobe Fonts (Typekit) kit serving Europa, the platform's heading font
            (--font-heading in @sparx/brand/theme.css). */}
        <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://use.typekit.net/rzb8qcq.css" />
      </head>
      <body>
        {/* Page-top navigation/loading bar — full module spectrum on sparx's
            own brand surface. */}
        <TopProgressBar />
        <PostHogProvider>
          {/* Silently recover a tab whose chunks were purged by a deploy. No
              visible "refresh" prompt on marketing pages — that's dashboard-only. */}
          <ChunkReloadGuard />
          <AttributionCapture />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_SCHEMA) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(PRODUCT_SCHEMA) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_SCHEMA) }}
          />
          <Nav />
          {children}
          <Footer />
          <ConsentBanner />
          <Toaster />
        </PostHogProvider>
      </body>
    </html>
  );
}

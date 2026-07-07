// sparx.market root layout.
//
// sparx.market is a SINGLE public host — sparx's own first-party shopping
// destination — so there's no per-tenant theme resolution (cf. apps/site). It
// wears the sparx brand directly via the `sparx` silicaui theme (see
// sparx-theme.css): Geist for body/mono, Inter for the wordmark (--font-wordmark,
// which the local <Wordmark> consumes). Every page is framed in the marketplace
// header + footer chrome. silicaui is the component layer; sparx is a consumer.

import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Inter } from 'next/font/google';
import { ChunkReloadGuard } from '@/components/chunk-reload-guard';

import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

// MUST be first: declares the cascade-layer order so the marketplace `mx-*`
// component classes rank correctly against silicaui's base-layer component
// styles and Tailwind preflight. See layers.css.
import './layers.css';
import './globals.css';

// Inter powers the sparx wordmark (bold, to match the monogram mark). Exposed as
// --font-wordmark, which the local <Wordmark> consumes.
const interWordmark = Inter({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-wordmark',
  display: 'swap',
});

const DESCRIPTION =
  'Shop thousands of independent sellers in one place. Real shops, real makers, shipped direct — discover products you won’t find on the big marketplaces.';

// Site-wide structured data so search + answer engines attribute the brand and
// can surface a sitelinks search box pointing at the marketplace catalog.
const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'sparx.market',
  url: 'https://sparx.market',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://sparx.market/products?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
  publisher: {
    '@type': 'Organization',
    name: 'WizeWorks, Inc.',
    url: 'https://wize.works',
  },
};

export const metadata: Metadata = {
  metadataBase: new URL('https://sparx.market'),
  title: {
    default: 'sparx.market — Shop independent sellers',
    template: '%s · sparx.market',
  },
  description: DESCRIPTION,
  applicationName: 'sparx.market',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'sparx.market',
    title: 'sparx.market — Shop independent sellers',
    description: DESCRIPTION,
    url: 'https://sparx.market',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'sparx.market — Shop independent sellers',
    description: 'One destination for thousands of independent sellers.',
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
  icons: {
    icon: [
      { url: '/sparx-icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="sparx"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${interWordmark.variable}`}
    >
      <body>
        {/* Silently recover a shopper's tab whose chunks were purged by a deploy. */}
        <ChunkReloadGuard />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_SCHEMA) }}
        />
        <div className="flex min-h-screen flex-col">
          <a
            href="#main-content"
            className="sr-only rounded-md px-3.5 py-2 shadow-md focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-[var(--color-bg-surface)] focus:text-[var(--color-text-primary)]"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main className="w-full flex-1" id="main-content" tabIndex={-1}>
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}

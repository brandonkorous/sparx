// sparx.market root layout.
//
// sparx.market is a SINGLE public host — sparx's own first-party shopping
// destination — so there's no per-tenant theme resolution (cf. apps/site). It
// wears the sparx brand directly via the `sparx` silicaui theme (the shared
// @sparx/brand package): Geist for body/mono, Inter for the wordmark (--font-wordmark,
// which the local <Wordmark> consumes). Every page is framed in the marketplace
// header + footer chrome. silicaui is the component layer; sparx is a consumer.

import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Inter } from 'next/font/google';
import { ChunkReloadGuard } from '@sparx/app-kit';

import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { SITE_ORIGIN } from '@/lib/site';

// MUST be first: declares the cascade-layer order so the marketplace `mx-*`
// component classes rank correctly against silicaui's base-layer component
// styles and Tailwind preflight. See @sparx/brand/layers.css.
import '@sparx/brand/layers.css';
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
//
// Emitted as a @graph with stable @ids rather than a lone WebSite with an inline
// publisher: the Organization becomes a first-class node engines can resolve and
// reconcile across sites (sparx.works emits its own), instead of an anonymous
// blob reachable only by walking into this WebSite. `publisher` then references
// that node by @id rather than restating it.
const SITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_ORIGIN}/#organization`,
      name: 'sparx.market',
      url: SITE_ORIGIN,
      description: DESCRIPTION,
      parentOrganization: {
        '@type': 'Organization',
        name: 'WizeWorks, Inc.',
        url: 'https://wize.works',
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_ORIGIN}/#website`,
      name: 'sparx.market',
      url: SITE_ORIGIN,
      description: DESCRIPTION,
      publisher: { '@id': `${SITE_ORIGIN}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_ORIGIN}/products?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
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
    url: SITE_ORIGIN,
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
      <head>
        {/* Adobe Fonts (Typekit) kit serving Europa, the platform's heading font
            (--font-heading in @sparx/brand/theme.css). */}
        <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://use.typekit.net/rzb8qcq.css" />
      </head>
      <body>
        {/* Silently recover a shopper's tab whose chunks were purged by a deploy. */}
        <ChunkReloadGuard />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_SCHEMA) }}
        />
        <div className="flex min-h-screen flex-col">
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

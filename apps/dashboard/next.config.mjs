import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  transpilePackages: [
    '@sparx/ui',
    '@sparx/brand',
    '@sparx/forms',
    '@wizeworks/silicaui-react',
    '@wizeworks/silicaui-charts',
    '@wizeworks/silicaui-table',
    '@wizeworks/silicaui-editor',
    '@wizeworks/silicaui-dnd',
    '@wizeworks/silicaui-panels',
    '@sparx/query',
    '@sparx/attribution',
    '@sparx/auth',
    '@sparx/db',
    '@sparx/crm',
    '@sparx/crm-schemas',
    '@sparx/cms-editor',
    '@sparx/cms-schemas',
    '@sparx/section-template-react',
    '@sparx/builder-render',
  ],
  serverExternalPackages: [
    '@prisma/client',
    'better-auth',
    '@google-cloud/pubsub',
    '@google-cloud/secret-manager',
    'google-gax',
    'google-auth-library',
    '@grpc/grpc-js',
    'gaxios',
    'https-proxy-agent',
    'agent-base',
  ],
  typedRoutes: true,
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../../'),
  async redirects() {
    return [
      // /cms/pages was the single-type list; it's now the unified content list.
      { source: '/cms/pages', destination: '/cms/content', permanent: true },
      // Finance hub (docs/109/110): Payments + Billing moved out of Settings into
      // the first-class Finance area. Keep deep links, bookmarks, and the Connect
      // onboarding hand-off working.
      { source: '/settings/payments', destination: '/finance/payments', permanent: true },
      { source: '/settings/billing', destination: '/finance/subscription', permanent: true },
      // Builder cutover (docs/builder/07 §2.2): the old split page editor is now the
      // one unified editor at /builder/studio, and /builder/page carries its
      // `?page=<id>` deep link through automatically (no query on the destination).
      //
      // There is NO /builder/site rule. There used to be — back when "site" meant the
      // site-LAYOUT editor — but /builder/site was repurposed as the site IDENTITY
      // surface (name, tagline, logo, favicon, socials) when theme moved into the
      // silica editor, and /builder/brand now redirects TO it. The stale rule made
      // those two fight: /builder/brand → /builder/site → /builder/studio, so the
      // identity page was unreachable from anywhere.
      { source: '/builder/page', destination: '/builder/studio', permanent: true },
    ];
  },
  async rewrites() {
    // Dev-only media-upload proxy. In local (non-GCS) mode api-rest's
    // `presignPut` returns a RELATIVE upload URL (`/v1/media/_local/...`) so the
    // browser PUTs same-origin; this proxy forwards it to api-rest. Without it
    // the bytes hit the dashboard origin and 404 (the cause of "upload doesn't
    // work" on the brand/media surfaces). In prod, uploads go straight to GCS
    // signed URLs — there is no `_local` route — so this rewrite is omitted.
    if (process.env.NODE_ENV === 'production') return [];
    const apiOrigin = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';
    return [
      {
        source: '/v1/media/_local/:path*',
        destination: `${apiOrigin}/v1/media/_local/:path*`,
      },
    ];
  },
};

export default config;

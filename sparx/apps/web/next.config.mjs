import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Report-only for now: the browser logs what this policy would block, and blocks
// nothing. Tighten and enforce once the console shows no real violations.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://us.i.posthog.com https://us-assets.i.posthog.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://use.typekit.net",
  "font-src 'self' data: https://fonts.gstatic.com https://use.typekit.net",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://api.sparx.works https://us.i.posthog.com https://us-assets.i.posthog.com https://app.wizelens.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self' https://app.sparx.works",
  "object-src 'none'",
].join('; ');

// Enforced alongside it: the three rules from that policy no page here can trip.
// The edge already allows framing only by this origin (X-Frame-Options
// SAMEORIGIN); base-uri and object-src close the <base> and plugin tricks.
const CSP_ENFORCED = "frame-ancestors 'self'; base-uri 'self'; object-src 'none'";

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // No `X-Powered-By: Next.js`: it tells a scanner which exploits to try.
  poweredByHeader: false,
  transpilePackages: [
    '@wizeworks/app-kit',
    '@wizeworks/ui',
    '@sparx/brand',
    '@wizeworks/forms',
    '@wizeworks/chat-widget',
    '@wizeworks/story-schemas',
    '@wizeworks/silicaui-react',
  ],
  typedRoutes: true,
  // WizeLens patches node:http and reads its own files: load it from node_modules, not a bundle.
  serverExternalPackages: ['@wizeworks/lens-node'],
  // Standalone output for Docker — produces .next/standalone with a minimal
  // node_modules and a server.js entrypoint.
  output: 'standalone',
  // Monorepo: tell Next.js to trace files starting at the repo root so
  // workspace deps (@wizeworks/ui) are included in the standalone bundle.
  outputFileTracingRoot: join(__dirname, '../../../'),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
          { key: 'Content-Security-Policy', value: CSP_ENFORCED },
        ],
      },
    ];
  },
};

export default config;

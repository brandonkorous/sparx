import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // No `X-Powered-By: Next.js`: it tells a scanner which exploits to try.
  poweredByHeader: false,
  transpilePackages: [
    '@wizeworks/app-kit',
    '@wizeworks/ui',
    '@wizeworks/cms-editor',
    '@wizeworks/chat-widget',
    '@wizeworks/builder-render',
  ],
  typedRoutes: false,
  // WizeLens patches node:http and reads its own files: load it from node_modules, not a bundle.
  serverExternalPackages: ['@wizeworks/lens-node'],
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../../../'),
  images: {
    // Media is served via api-rest's redirecting /v1/public/media endpoint, so
    // we drive next/image through a custom loader rather than the built-in
    // optimizer (which can't process a 302). See lib/image-loader.ts.
    loader: 'custom',
    loaderFile: './lib/image-loader.ts',
  },
  // Caddy adds nosniff at the edge; the app sends it too for in-cluster callers (WW-12).
  //
  // The CSP is an ENFORCED baseline of rules no tenant page can trip. The edge
  // already allows framing only by this origin (X-Frame-Options SAMEORIGIN), and
  // frame-ancestors says the same in CSP terms; base-uri closes the <base> trick
  // (WizeLens, 2026-10-29). No object-src here: a tenant's own content is not ours
  // to narrow without looking at it first.
  headers: () =>
    Promise.resolve([
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'self'" },
        ],
      },
    ]),
};

export default config;

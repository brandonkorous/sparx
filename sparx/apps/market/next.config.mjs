import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // No `X-Powered-By: Next.js`: it tells a scanner which exploits to try.
  poweredByHeader: false,
  // An ENFORCED baseline CSP of rules no page here can trip. The edge already
  // allows framing only by this origin (X-Frame-Options SAMEORIGIN),
  // and frame-ancestors says the same in CSP terms; base-uri and object-src close
  // the <base> and plugin tricks (WizeLens, 2026-10-29).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
  transpilePackages: ['@wizeworks/silicaui-react', '@sparx/brand', '@wizeworks/app-kit'],
  typedRoutes: false,
  // WizeLens patches node:http and reads its own files: load it from node_modules, not a bundle.
  serverExternalPackages: ['@wizeworks/lens-node'],
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../../../'),
  images: {
    // Marketplace product/merchant media is served via api-rest's redirecting
    // /v1/public/media endpoint (a 302), which the built-in optimizer can't
    // process — so we drive next/image through a custom loader. See
    // lib/image-loader.ts (mirrors wizeworks/apps/site).
    loader: 'custom',
    loaderFile: './lib/image-loader.ts',
  },
};

export default config;

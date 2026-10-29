import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // No `X-Powered-By: Next.js`: it tells a scanner which exploits to try.
  poweredByHeader: false,
  // An ENFORCED baseline CSP of rules no page here can trip. The edge already
  // refuses all framing (X-Frame-Options DENY),
  // and frame-ancestors says the same in CSP terms; base-uri and object-src close
  // the <base> and plugin tricks (WizeLens, 2026-10-29).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
  transpilePackages: [
    '@piggles/brand',
    '@piggles/config',
    '@piggles/mascot',
    '@wizeworks/app-kit',
    '@wizeworks/auth',
    '@wizeworks/client-ip',
    '@wizeworks/silicaui-react',
  ],
  typedRoutes: true,
  // WizeLens patches node:http and reads its own files: load it from node_modules, not a bundle.
  serverExternalPackages: ['@wizeworks/lens-node'],
  output: 'standalone',
  // Monorepo: trace from the REPO root, not from `piggles/`. This app pulls
  // workspace deps from BOTH trees — `@piggles/*` alongside it and `@wizeworks/auth`
  // above it — so a tracing root inside `piggles/` would produce a standalone
  // bundle missing the platform half.
  outputFileTracingRoot: join(__dirname, '../../../'),
};

export default config;

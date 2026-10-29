import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEV = process.env.NODE_ENV !== 'production';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** One allow-list entry for an origin, or null if it is not a usable URL. */
function mediaPattern(value) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  // `localhost:3100` with no scheme PARSES, as a protocol with no host at all.
  if (!url.hostname) return null;
  return {
    protocol: url.protocol === 'https:' ? 'https' : 'http',
    hostname: url.hostname,
    ...(url.port ? { port: url.port } : {}),
    pathname: '/v1/public/media/**',
  };
}

/**
 * The api-rest origin as an image host, for local development.
 *
 * Loopback is always listed: a blank or unparseable `NEXT_PUBLIC_API_URL` is
 * skipped rather than taking the rest of the list with it (issue 189). A
 * non-loopback value, a LAN address for testing on a phone, is dev-only.
 *
 * @returns {import('next').NextConfig['images']['remotePatterns']}
 */
function devMediaPatterns() {
  const configured = mediaPattern(process.env.NEXT_PUBLIC_API_URL);
  const patterns = [
    mediaPattern('http://localhost:3100'),
    mediaPattern('http://127.0.0.1:3100'),
    ...(configured && (LOOPBACK.has(configured.hostname) || DEV) ? [configured] : []),
  ].filter(Boolean);

  const seen = new Set();
  return patterns.filter((pattern) => {
    const key = `${pattern.protocol}//${pattern.hostname}:${pattern.port ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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
  // `next build` type-checks without the tests: some import files outside the image
  // (scripts/, a sibling app), and the CI Typecheck job still checks them.
  typescript: { tsconfigPath: './tsconfig.build.json' },
  // Every workspace package this app's graph reaches that ships raw TypeScript.
  // Deliberately NOT kept in step with sparx's list: separate applications.
  transpilePackages: [
    '@piggles/brand',
    '@piggles/config',
    '@piggles/mascot',
    '@wizeworks/app-kit',
    '@wizeworks/silicaui-react',
    '@wizeworks/silicaui-charts',
    '@wizeworks/silicaui-editor',
    '@wizeworks/silica-corrections',
    '@wizeworks/api-client',
    '@wizeworks/cms-editor',
    '@wizeworks/builder-schemas',
    '@wizeworks/silica-catalog',
    '@wizeworks/site-themes',
    '@wizeworks/social',
  ],
  typedRoutes: false,
  // WizeLens patches node:http and reads its own files: load it from node_modules, not a bundle.
  serverExternalPackages: ['@wizeworks/lens-node'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.sparx.works', pathname: '/v1/public/media/**' },
      ...devMediaPatterns(),
    ],
    // Next refuses an upstream image that resolves to a loopback address. In
    // development the media host IS localhost, so every photo is blocked. The
    // production media host is public and this stays off there.
    dangerouslyAllowLocalIP: DEV,
  },
  output: 'standalone',
  // Trace from the REPO root: this app pulls from `piggles/` and `wizeworks/` both.
  outputFileTracingRoot: join(__dirname, '../../../'),
};

export default config;

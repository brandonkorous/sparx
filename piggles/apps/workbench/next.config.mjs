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

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * The local api-rest origin as an image host, in development only.
 *
 * Identical to the shared workbench's, and for the identical reason: tenant
 * media lives on a different origin, so every thumbnail is a remote image and
 * `next/image` refuses one that is not allow-listed. The shared surfaces render
 * those thumbnails here too, so the allow-list has to be here too — a Next
 * config does not travel with the component that needs it.
 *
 * @returns {import('next').NextConfig['images']['remotePatterns']}
 */
function devMediaPatterns() {
  if (process.env.NODE_ENV === 'production') return [];
  try {
    const api = new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3100');
    return [
      {
        protocol: api.protocol === 'https:' ? 'https' : 'http',
        hostname: api.hostname,
        ...(api.port ? { port: api.port } : {}),
        pathname: '/v1/public/media/**',
      },
    ];
  } catch {
    return [];
  }
}

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // ── Every workspace package that ships raw TypeScript ─────────────────────
  //
  // A `transpilePackages` entry belongs to a BUILD, not to the file that needs
  // it, so every source-shipping package this app's graph reaches has to be
  // listed here.
  //
  // This list happens to resemble the sparx workbench's, because the two apps
  // grew from one and use the same libraries. It is NOT kept in step with it and
  // must not be: they are separate applications (piggles/CLAUDE.md RULE #0), and
  // either one may add or drop a package without the other caring.
  transpilePackages: [
    '@piggles/brand',
    '@piggles/config',
    '@piggles/mascot',
    '@sparx/app-kit',
    '@wizeworks/silicaui-react',
    '@wizeworks/silicaui-charts',
    '@wizeworks/silicaui-editor',
    '@wizeworks/silica-corrections',
    '@sparx/api-client',
    '@sparx/cms-editor',
    '@sparx/builder-schemas',
    '@sparx/silica-catalog',
    '@sparx/site-themes',
    '@sparx/social',
  ],
  typedRoutes: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.sparx.works', pathname: '/v1/public/media/**' },
      ...devMediaPatterns(),
    ],
  },
  output: 'standalone',
  // Trace from the REPO root, not from `piggles/`. This app pulls from BOTH
  // trees — `@piggles/*` beside it, `@sparx/*` and the shared workbench source
  // above it — so a tracing root inside `piggles/` produces a standalone bundle
  // missing the platform half.
  outputFileTracingRoot: join(__dirname, '../../../'),
};

export default config;

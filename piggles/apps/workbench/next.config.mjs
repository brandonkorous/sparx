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
  // ── Why this list mirrors apps/workbench's ────────────────────────────────
  //
  // This app MOUNTS the shared workbench's surfaces (piggles/CLAUDE.md RULE #0:
  // the shell forks, the surfaces do not), so its module graph is that app's
  // module graph. Every workspace package that ships raw TypeScript therefore
  // has to be transpiled HERE as well — a `transpilePackages` entry belongs to a
  // build, not to the file that needs it, so nothing about the shared app's own
  // config carries over.
  //
  // Divergence between the two lists is a build error waiting for whoever adds
  // the next source-shipping package. Keep them in step.
  transpilePackages: [
    '@piggles/brand',
    '@piggles/config',
    '@sparx/app-kit',
    '@wizeworks/silicaui-react',
    '@wizeworks/silicaui-charts',
    '@wizeworks/silicaui-editor',
    '@sparx/brand',
    '@sparx/api-client',
    '@sparx/cms-editor',
    '@sparx/ui',
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

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * The local api-rest origin as an image host, in development only.
 *
 * Returns nothing in production (where media comes from the CDN) and nothing if
 * NEXT_PUBLIC_API_URL is missing or unparseable — a bad value must not take the
 * whole config down at boot.
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
  // @sparx/api-client ships raw TypeScript (main points at src/index.ts), so it
  // must be transpiled rather than treated as a prebuilt dependency. workbench
  // is its first consumer — it had never been through a bundler before.
  transpilePackages: [
    '@sparx/app-kit',
    '@wizeworks/silicaui-react',
    '@wizeworks/silicaui-charts',
    // The rich-text editor (bootcamp description) ships a client TipTap surface.
    '@wizeworks/silicaui-editor',
    '@sparx/brand',
    '@sparx/api-client',
    // The CMS block editor ships raw TypeScript/TSX (its exports point at
    // ./src/*), so it must be transpiled rather than treated as prebuilt — and
    // so must @sparx/ui, which it imports `cn` from and which also ships source.
    '@sparx/cms-editor',
    '@sparx/ui',
    // The visual site builder (builder.studio) mounts silica's <Builder> over a
    // sparx BuilderHost; these ship raw TypeScript from ./src.
    '@sparx/builder-schemas',
    '@sparx/silica-catalog',
    '@sparx/site-themes',
    // The social calendar imports `slotOccurrences` — a RUNTIME value, unlike the
    // type-only schema packages above, whose imports erase at compile time. So this one
    // ships source that actually has to be compiled. It is imported via the narrow
    // `@sparx/social/cadence` entrypoint rather than the package barrel: the barrel's
    // internal `./thing.js` specifiers are not rewritten to `.ts` by Turbopack, so
    // reaching for the barrel here fails the production build even though dev and
    // typecheck pass. `cadence.ts` has no relative imports at all.
    '@sparx/social',
  ],
  typedRoutes: false,
  // Tenant media lives on a DIFFERENT origin from the workbench, so every
  // thumbnail is a remote image and `next/image` refuses one that is not
  // allow-listed here. Two hosts, because the media origin differs by
  // environment:
  //
  //   prod — https://media.sparx.works, the Cloudflare-fronted public bucket
  //          (k8s/sparx-prod/app-env-configmap.yaml: MEDIA_PUBLIC_URL).
  //   dev  — api-rest itself, which serves `/v1/public/media/file/*` off disk
  //          when GCS_MEDIA_BUCKET is unset. Derived from NEXT_PUBLIC_API_URL
  //          rather than hardcoded to :3100, so a developer running api-rest on
  //          another port still gets thumbnails instead of a blank grid.
  //
  // Pathnames are pinned to the media routes: an allow-listed HOST would
  // otherwise let any path on the API origin be proxied through the image
  // optimizer.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.sparx.works', pathname: '/v1/public/media/**' },
      ...devMediaPatterns(),
    ],
  },
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../../'),
};

export default config;

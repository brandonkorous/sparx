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
  transpilePackages: ['@wizeworks/silicaui-react', '@sparx/brand', '@sparx/api-client'],
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

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  transpilePackages: ['@sparx/ui'],
  typedRoutes: false,
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../../'),
  images: {
    // Marketplace product/merchant media is served via api-rest's redirecting
    // /v1/public/media endpoint (a 302), which the built-in optimizer can't
    // process — so we drive next/image through a custom loader. See
    // lib/image-loader.ts (mirrors apps/site).
    loader: 'custom',
    loaderFile: './lib/image-loader.ts',
  },
};

export default config;

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  transpilePackages: [
    '@wizeworks/app-kit',
    '@wizeworks/ui',
    '@sparx/brand',
    '@wizeworks/forms',
    '@wizeworks/chat-widget',
    '@wizeworks/story-schemas',
    '@wizeworks/silicaui-react',
  ],
  typedRoutes: true,
  // Standalone output for Docker — produces .next/standalone with a minimal
  // node_modules and a server.js entrypoint.
  output: 'standalone',
  // Monorepo: tell Next.js to trace files starting at the repo root so
  // workspace deps (@wizeworks/ui) are included in the standalone bundle.
  outputFileTracingRoot: join(__dirname, '../../../'),
};

export default config;

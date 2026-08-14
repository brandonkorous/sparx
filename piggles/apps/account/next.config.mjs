import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  transpilePackages: [
    '@piggles/brand',
    '@piggles/config',
    '@sparx/auth',
    '@wizeworks/silicaui-react',
  ],
  typedRoutes: true,
  output: 'standalone',
  // Monorepo: trace from the REPO root, not from `piggles/`. This app pulls
  // workspace deps from BOTH trees — `@piggles/*` alongside it and `@sparx/auth`
  // above it — so a tracing root inside `piggles/` would produce a standalone
  // bundle missing the platform half.
  outputFileTracingRoot: join(__dirname, '../../../'),
};

export default config;

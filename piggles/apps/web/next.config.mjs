import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  transpilePackages: [
    '@piggles/brand',
    '@piggles/config',
    '@piggles/mascot',
    '@wizeworks/app-kit',
    '@wizeworks/silicaui-react',
  ],
  typedRoutes: true,
  // WizeLens patches node:http and reads its own files: load it from node_modules, not a bundle.
  serverExternalPackages: ['@wizeworks/lens-node'],
  output: 'standalone',
  // Monorepo: trace from the REPO root, not from `piggles/`. The workspace deps
  // this app pulls resolve above its own tree, so a tracing root inside
  // `piggles/` would produce a standalone bundle missing them.
  outputFileTracingRoot: join(__dirname, '../../../'),
};

export default config;

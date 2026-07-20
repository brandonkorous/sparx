import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // @sparx/api-client ships raw TypeScript (main points at src/index.ts), so it
  // must be transpiled rather than treated as a prebuilt dependency. workbench
  // is its first consumer — it had never been through a bundler before.
  transpilePackages: ['@wizeworks/silicaui-react', '@sparx/brand', '@sparx/api-client'],
  typedRoutes: false,
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../../'),
};

export default config;

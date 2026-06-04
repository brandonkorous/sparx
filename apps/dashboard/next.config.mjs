import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  transpilePackages: [
    '@sparx/ui',
    '@sparx/auth',
    '@sparx/db',
    '@sparx/crm',
    '@sparx/crm-schemas',
    '@sparx/cms-editor',
    '@sparx/cms-schemas',
    '@sparx/section-template-react',
  ],
  serverExternalPackages: ['@prisma/client', 'better-auth'],
  typedRoutes: true,
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../../'),
  async redirects() {
    return [
      // /cms/pages was the single-type list; it's now the unified content list.
      { source: '/cms/pages', destination: '/cms/content', permanent: true },
    ];
  },
};

export default config;

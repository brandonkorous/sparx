import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  transpilePackages: [
    '@sparx/ui',
    '@sparx/brand',
    '@sparx/forms',
    '@wizeworks/silicaui-react',
    '@sparx/operator',
    '@sparx/operator-auth',
  ],
  // Keep the operator auth instance's native/server-only deps external to the
  // Next bundle — pg (the wize_admin pool) + Better Auth + the @sparx/events
  // Pub/Sub client (used by the operator set-password email path).
  serverExternalPackages: [
    'better-auth',
    'pg',
    '@google-cloud/pubsub',
    '@google-cloud/secret-manager',
    'google-gax',
    'google-auth-library',
    '@grpc/grpc-js',
    'gaxios',
    'https-proxy-agent',
    'agent-base',
  ],
  typedRoutes: true,
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../../'),
};

export default config;

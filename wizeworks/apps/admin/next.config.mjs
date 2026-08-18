import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  transpilePackages: [
    '@wizeworks/ui',
    '@wizeworks/brand',
    '@wizeworks/forms',
    '@wizeworks/silicaui-react',
    '@wizeworks/operator',
    '@wizeworks/operator-auth',
  ],
  // Keep the operator auth instance's native/server-only deps external to the
  // Next bundle — pg (the wize_admin pool) + Better Auth + the @wizeworks/events
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
  outputFileTracingRoot: join(__dirname, '../../../'),
  // Turbopack infers the workspace root by walking up for a lockfile, and in this
  // monorepo it guessed `wizeworks/apps/admin/app` — from which `next/package.json` is not
  // resolvable, so `pnpm dev` died with "Next.js inferred your workspace root, but
  // it may not be correct" and (because turbo fails the run on one task) took the
  // WHOLE dev stack down with it. Pin the root explicitly, as the error advises.
  turbopack: { root: join(__dirname, '../../../') },
};

export default config;

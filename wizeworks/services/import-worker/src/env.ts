// Environment configuration for the import-worker.
//
// Required: DATABASE_URL (Prisma connection string via Cloud SQL Auth Proxy).
// Optional: PORT (defaults to 8080), LOG_LEVEL (defaults to 'info'),
//           PUBSUB_INVOKER_SA (e.g. 'import-worker@project.iam.gserviceaccount.com').

import { config } from 'dotenv';
config();

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  DATABASE_URL: required('DATABASE_URL'),
  PORT: parseInt(optional('PORT', '8080'), 10),
  LOG_LEVEL: optional('LOG_LEVEL', 'info'),
  PUBSUB_INVOKER_SA: optional('PUBSUB_INVOKER_SA', ''),
} as const;

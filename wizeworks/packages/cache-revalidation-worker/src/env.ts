// The two settings only this handler understands. The event worker validates
// what the process as a whole needs (DATABASE_URL, the broker, the port); each
// handler library owns its own, the same way commerce-indexer owns the Typesense
// keys. See wizeworks/services/event-worker/src/env.ts.
//
// SPARX_REVALIDATE_SECRET is OPTIONAL HERE ON PURPOSE, and that is not the same
// as optional. Every handler shares one process now, so making it required at
// boot would let a missing cache secret stop email, search and the automation
// tick along with it. Instead the subscription logs an error the moment it is
// created and every purge THROWS (src/handler.ts), which naks the message so the
// broker retries it and the failure is in the logs on every event. In the
// cluster the release mints the value into `sparx-app-secrets` when it is not
// supplied, so the site and this worker always hold the same one.

import 'dotenv/config';
import { z } from 'zod';

/** A blank value in a dotenv file or a Secret means "not set", not "set to ''". */
const blankIsUnset = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const EnvSchema = z.object({
  // The site's on-demand revalidation route. ONE deployment serves every
  // tenant's website (the tenant is resolved from the Host header), so this is a
  // single internal URL and the tenant travels in the POST body. The default is
  // the in-cluster Service: `site`, port 3000, in sparx-prod (k8s/apps/site.yaml).
  // Locally the site runs on :3004, set in the event worker's .env.
  //
  // The old Cloud Run service defaulted to `http://storefront.sparx-prod…`, a
  // Service that has not existed since the storefront was renamed. It was never
  // deployed, so nothing ever found out.
  SITE_REVALIDATE_URL: z.preprocess(
    blankIsUnset,
    z.string().url().default('http://site.sparx-prod.svc.cluster.local:3000/api/revalidate')
  ),
  // Shared with the site's /api/revalidate route, which refuses without it.
  SPARX_REVALIDATE_SECRET: z.preprocess(blankIsUnset, z.string().min(1).optional()),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('[cache-revalidation-worker] invalid environment:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(78); // EX_CONFIG
  }
  return result.data;
}

export const env: Env = parseEnv();

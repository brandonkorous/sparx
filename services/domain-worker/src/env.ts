import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  GCP_PROJECT_ID: z.string().optional(),
  PUBSUB_INVOKER_SA: z.string().email().optional(),
  SPARX_INTERNAL_CRON_TOKEN: z.string().min(16).optional(),
  GODADDY_API_KEY_OTE: z.string().optional(),
  GODADDY_API_SECRET_OTE: z.string().optional(),
  GODADDY_API_KEY_PROD: z.string().optional(),
  GODADDY_API_SECRET_PROD: z.string().optional(),
  // Override decoupling the GoDaddy environment from NODE_ENV; unset → follows
  // NODE_ENV. See @sparx/godaddy resolveEnv (OTE sandbox is chronically degraded).
  GODADDY_ENV: z.enum(['prod', 'production', 'ote', 'test']).optional(),
  SPARX_CNAME_TARGET: z.string().default('customers.sparx.zone'),
  // Where the workbench lives is NOT declared here any more. It was one of four
  // environment variables naming the same URL, each read by a different emitter
  // with its own fallback — so which host an email pointed at depended on which
  // service sent it. `@sparx/links/server`'s `appOrigin()` reads them all, in one
  // fixed order, in one place. The variables themselves still work; only the
  // per-service opinion about them is gone.
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('[domain-worker] invalid environment:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(78); // EX_CONFIG
  }
  return result.data;
}

export const env: Env = parseEnv();

import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(8080),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  DATABASE_URL: z.string().min(1),
  GCP_PROJECT_ID: z.string().optional(),
  PUBSUB_INVOKER_SA: z.string().email().optional(),
  SPARX_INTERNAL_CRON_TOKEN: z.string().min(16).optional(),
  GODADDY_API_KEY_OTE: z.string().optional(),
  GODADDY_API_SECRET_OTE: z.string().optional(),
  GODADDY_API_KEY_PROD: z.string().optional(),
  GODADDY_API_SECRET_PROD: z.string().optional(),
  SPARX_CNAME_TARGET: z.string().default('customers.sparx.zone'),
  SPARX_DASHBOARD_URL: z.string().default('https://app.sparx.works'),
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

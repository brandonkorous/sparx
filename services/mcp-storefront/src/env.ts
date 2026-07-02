// Boot-time env validation (mirrors services/api-mcp/src/env.ts).

import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3200),
  HOST: z.string().default('0.0.0.0'),
  // The public storefront API this server adapts. Every tool is a call to a
  // /v1/public/* route on this origin (docs/113 §3.1). In-cluster:
  // http://api-rest.sparx-prod.svc.cluster.local:3000; local dev: :3100.
  SPARX_API_REST_URL: z.string().min(1),
  // This server's own public origin, used to build discovery URLs advertised in
  // llms.txt (e.g. https://mcp.sparx.zone). Optional — falls back to the request.
  STOREFRONT_MCP_PUBLIC_ORIGIN: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('[mcp-storefront] invalid environment:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(78);
  }
  return result.data;
}

export const env: Env = parseEnv();

// Boot-time env validation.

import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  // Same internal JWT secret api-rest uses — the dashboard mints short-lived
  // tokens for the MCP transport so the auth model is symmetric. External
  // API keys land later via the AI Integrations dashboard.
  SPARX_INTERNAL_JWT_SECRET: z.string().min(32),
  // OAuth 2.1 resource-server wiring (docs/07 §5). MCP_RESOURCE_URL is this
  // server's canonical resource identifier (the audience tokens are for);
  // MCP_AUTH_SERVER_URL is the authorization server (the dashboard/Better Auth
  // origin) advertised in the protected-resource metadata. OAuth token
  // verification reads the shared auth DB via @wizeworks/auth (sparx_owner), so
  // AUTH_DATABASE_URL must also be present in the environment.
  MCP_RESOURCE_URL: z.string().default('http://localhost:3000/mcp'),
  MCP_AUTH_SERVER_URL: z.string().default('http://localhost:3001'),
  // Enables the real Pub/Sub bridge for CRM customer writes made via MCP
  // tools. Unset (dev) → the bridge is a no-op and writes stay on the stub.
  GCP_PROJECT_ID: z.string().optional(),
  // The cluster Redis (same instance api-rest's socket.io adapter uses). When set,
  // a builder write made via MCP is relayed into the site's editor room over the
  // socket.io Redis backplane (docs/126 §4.5), so an operator with the studio open
  // sees the agent's change fold in live. Unset (dev, or no co-editing) → no relay;
  // the write still persists and the explicit-delete floor keeps it safe.
  REDIS_URL: z.string().optional(),
  // Active domain registrar for the domain MCP tools (docs/24). Selects the
  // provider behind the @wizeworks/registrar `RegistrarClient` contract. 'godaddy'
  // today; 'namecom' once its @sparx/namecom client is wired.
  REGISTRAR: z.enum(['godaddy', 'namecom']).default('godaddy'),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('[api-mcp] invalid environment:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(78);
  }
  return result.data;
}

export const env: Env = parseEnv();

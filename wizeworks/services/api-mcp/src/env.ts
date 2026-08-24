// Boot-time env validation.

import 'dotenv/config';
import { z } from 'zod';
import { DEFAULT_BRAND, mcpAuthServerOrigin, mcpResourceUrl } from '@wizeworks/links/server';

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
  // OAuth 2.1 resource-server wiring (docs/07 §5). The resource identifier and
  // the authorization server are BOTH per brand and both resolved through
  // @wizeworks/links/server from `<BRAND>_MCP_URL` and `<BRAND>_ACCOUNT_URL` —
  // one api-mcp serves every brand, and the protected-resource document is
  // fetched before any token exists, so the request's HOST is the only thing
  // carrying the brand (see oauth-metadata.ts). PLATFORM_BRANDS is the list this
  // deployment serves; it is what turns those derived variable names into a
  // host→brand map, and it is the ONLY place a brand key is enumerated.
  //
  // OAuth token verification reads the shared auth DB via @wizeworks/auth
  // (sparx_owner), so AUTH_DATABASE_URL must also be present in the environment.
  PLATFORM_BRANDS: z
    .string()
    .default(DEFAULT_BRAND)
    .transform((raw) =>
      raw
        .split(',')
        .map((part) => part.trim().toLowerCase())
        .filter((part) => part !== '')
    )
    .refine((brands) => brands.length > 0, 'PLATFORM_BRANDS must name at least one brand'),
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
  assertBrandAddresses(result.data.PLATFORM_BRANDS);
  return result.data;
}

/**
 * Every brand this deployment serves must have a resolvable MCP address and
 * authorization server, and we prove it at boot rather than at the first
 * customer's connection attempt.
 *
 * A missing `<BRAND>_MCP_URL` does not fail loudly on its own: the host→brand map
 * would simply not learn that brand's hostname, that brand's customers would be
 * answered as the DEFAULT brand, and the result reads exactly like working
 * software — a 200, a valid document, the wrong company's sign-in page. So the
 * check is here, it names the variable to set, and it stops the rollout.
 */
function assertBrandAddresses(brands: readonly string[]): void {
  const problems: string[] = [];
  for (const brand of brands) {
    // Both must RESOLVE (the lookup throws in production when unconfigured) and
    // both must PARSE — a typo'd address is a hostname the host→brand map will
    // never match, which fails exactly the same silent way an absent one does.
    try {
      const resource = new URL(mcpResourceUrl(brand));
      const authServer = new URL(mcpAuthServerOrigin(brand));
      if (resource.host === '') problems.push(`  - ${brand}: its MCP address names no host`);
      if (authServer.host === '') {
        problems.push(`  - ${brand}: its authorization server names no host`);
      }
    } catch (err) {
      problems.push(`  - ${brand}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (problems.length === 0) return;
  console.error('[api-mcp] brands in PLATFORM_BRANDS with no usable MCP address:');
  for (const line of problems) console.error(line);
  process.exit(78);
}

export const env: Env = parseEnv();

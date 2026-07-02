// MCP transport auth. Two paths accepted:
//
//   1. Internal-trust JWT — minted by the dashboard for first-party calls
//      from logged-in staff. Same payload shape api-rest uses (sub, tid,
//      role + optional `scopes`).
//
//   2. External API key — `Bearer sk_live_<8>_<32>`. Issued by the AI
//      Integrations dashboard, verified via @sparx/auth/api-keys. Scopes
//      come from the key row; role is fixed as 'api'.
//
// In both cases the tenant must have the `ai` MODULE active. sparx is
// module-based (a tenant pays per module, not per plan tier) — MCP / the AI
// Integrations surface IS the `ai` module, so that flag is the eligibility
// gate. Per-tool scopes still decide which tools run.

import fastifyJwt from '@fastify/jwt';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { isModuleEnabled, verifyApiKey, verifyMcpOAuthToken } from '@sparx/auth';
import { env } from './env.js';

export type StaffRole = 'owner' | 'admin' | 'editor' | 'viewer' | 'api';

// Platform-wide MCP scope vocabulary. Each module contributes its read/write
// scopes; the server stores scopes as plain strings so a new module's scopes
// don't require widening this type at every call site.
export type McpScope =
  | 'read:crm'
  | 'write:crm'
  | 'write:crm_bulk'
  | 'read:commerce'
  | 'write:commerce'
  | 'write:commerce_bulk'
  | 'read:inventory'
  | 'write:inventory'
  | 'read:builder'
  | 'write:builder'
  | 'read:email'
  | 'write:email'
  | 'write:email_bulk'
  | 'read:search'
  | 'read:automations'
  | 'write:automations'
  | 'read:domains'
  | 'write:domains'
  | 'read:invoicing'
  | 'write:invoicing'
  | 'read:scheduling'
  | 'write:scheduling';

export interface McpAuthContext {
  tenantId: string;
  userId: string;
  role: StaffRole;
  scopes: ReadonlySet<string>;
  /** 'jwt' for first-party staff tokens, 'api_key' for external sk_live_ keys,
   *  'oauth' for tokens minted by the MCP OAuth flow (Claude/ChatGPT connectors). */
  source: 'jwt' | 'api_key' | 'oauth';
}

interface InternalJwtPayload {
  sub: string;
  tid: string;
  role: Exclude<StaffRole, 'api'>;
  scopes?: McpScope[];
}

const DEFAULT_SCOPES_BY_ROLE: Record<StaffRole, McpScope[]> = {
  owner: [
    'read:crm',
    'write:crm',
    'write:crm_bulk',
    'read:commerce',
    'write:commerce',
    'write:commerce_bulk',
    'read:inventory',
    'write:inventory',
    'read:builder',
    'write:builder',
    'read:email',
    'write:email',
    'write:email_bulk',
    'read:search',
    'read:automations',
    'write:automations',
    'read:domains',
    'write:domains',
    'read:invoicing',
    'write:invoicing',
    'read:scheduling',
    'write:scheduling',
  ],
  admin: [
    'read:crm',
    'write:crm',
    'write:crm_bulk',
    'read:commerce',
    'write:commerce',
    'write:commerce_bulk',
    'read:inventory',
    'write:inventory',
    'read:builder',
    'write:builder',
    'read:email',
    'write:email',
    'write:email_bulk',
    'read:search',
    'read:automations',
    'write:automations',
    'read:domains',
    'write:domains',
    'read:invoicing',
    'write:invoicing',
    'read:scheduling',
    'write:scheduling',
  ],
  editor: [
    'read:crm',
    'write:crm',
    'read:commerce',
    'write:commerce',
    'read:inventory',
    'write:inventory',
    'read:builder',
    'write:builder',
    'read:email',
    'write:email',
    'read:search',
    'read:automations',
    'write:automations',
    'read:domains',
    'read:invoicing',
    'write:invoicing',
    'read:scheduling',
    'write:scheduling',
  ],
  viewer: [
    'read:crm',
    'read:commerce',
    'read:inventory',
    'read:builder',
    'read:email',
    'read:search',
    'read:automations',
    'read:domains',
    'read:invoicing',
    'read:scheduling',
  ],
  // External api keys have no role-derived default; their scope list is
  // exactly what the dashboard issued.
  api: [],
};

declare module 'fastify' {
  interface FastifyRequest {
    mcpAuth: McpAuthContext | null;
  }
}

const authPlugin: FastifyPluginAsync = async (app) => {
  await app.register(fastifyJwt, {
    secret: env.SPARX_INTERNAL_JWT_SECRET,
    verify: { algorithms: ['HS256'] },
  });
  app.decorateRequest('mcpAuth', null);
};

export default fp(authPlugin, { name: 'mcp-auth' });

/** Verifies the bearer token and returns the auth context. Routes the
 *  inspection between API-key and JWT paths based on the token shape. */
export async function authenticate(request: FastifyRequest): Promise<McpAuthContext> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AuthError('Missing or malformed Authorization header');
  }
  const token = header.slice('Bearer '.length).trim();

  // Route by token shape:
  //   • sk_live_… → external API key
  //   • three dot-separated segments → first-party internal JWT (HS256)
  //   • anything else → opaque MCP OAuth access token (32-char random string)
  let auth: McpAuthContext;
  if (token.startsWith('sk_live_')) {
    auth = await authenticateApiKey(token);
  } else if (token.split('.').length === 3) {
    auth = await authenticateJwt(request);
  } else {
    auth = await authenticateOAuth(token);
  }

  // MCP is the `ai` module's capability — gate on it (module-based, not a plan
  // tier). A tenant without the AI module active can't reach the MCP server at
  // all; the per-tool scopes then decide which module's tools each call can run.
  const aiEnabled = await isModuleEnabled(auth.tenantId, 'ai');
  if (!aiEnabled) {
    throw new AuthError(
      'The AI module is not active for this tenant. Enable it to use the MCP server.'
    );
  }

  request.mcpAuth = auth;
  return auth;
}

async function authenticateApiKey(token: string): Promise<McpAuthContext> {
  const verified = await verifyApiKey(token);
  if (!verified) {
    throw new AuthError('Invalid, revoked, or expired API key');
  }
  return {
    tenantId: verified.tenantId,
    userId: verified.actorId,
    role: 'api',
    scopes: new Set(verified.scopes as McpScope[]),
    source: 'api_key',
  };
}

async function authenticateOAuth(token: string): Promise<McpAuthContext> {
  // Opaque access token minted by the MCP OAuth flow. verifyMcpOAuthToken
  // enforces expiry + client-not-disabled and resolves the tenant (the plugin's
  // own getMcpSession skips expiry — see @sparx/auth/mcp-oauth).
  const verified = await verifyMcpOAuthToken(token);
  if (!verified) {
    throw new AuthError('Invalid, expired, or revoked OAuth access token');
  }
  return {
    tenantId: verified.tenantId,
    userId: verified.userId,
    role: 'api',
    scopes: new Set(verified.scopes),
    source: 'oauth',
  };
}

async function authenticateJwt(request: FastifyRequest): Promise<McpAuthContext> {
  let payload: InternalJwtPayload;
  try {
    payload = await request.jwtVerify<InternalJwtPayload>();
  } catch {
    throw new AuthError('Invalid or expired token');
  }
  if (!payload.sub || !payload.tid) {
    throw new AuthError('Token is missing required claims');
  }
  const granted = payload.scopes ?? DEFAULT_SCOPES_BY_ROLE[payload.role] ?? [];
  return {
    tenantId: payload.tid,
    userId: payload.sub,
    role: payload.role,
    scopes: new Set(granted),
    source: 'jwt',
  };
}

export class AuthError extends Error {
  readonly code = 'UNAUTHORIZED' as const;
  constructor(message: string) {
    super(message);
  }
}

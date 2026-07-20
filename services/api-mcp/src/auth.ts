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
import {
  grantableScopesForRole,
  isModuleEnabled,
  verifyApiKey,
  verifyMcpOAuthToken,
  type McpBusinessScope,
} from '@sparx/auth';
import { env } from './env.js';

export type StaffRole = 'owner' | 'admin' | 'editor' | 'viewer' | 'api';

// Platform-wide MCP scope vocabulary — RE-EXPORTED from @sparx/auth, never
// re-declared. This used to be a hand-copied union, and the copy silently fell
// behind: the CMS tools shipped requiring `read:cms`/`write:cms` while both this
// list and the grantable-scope catalog still predated them, so the entire content
// surface was unreachable over MCP. A module's scopes now reach every gate the
// moment they land in the catalog.
export type McpScope = McpBusinessScope;

export interface McpAuthContext {
  tenantId: string;
  userId: string;
  role: StaffRole;
  scopes: ReadonlySet<string>;
  /** 'jwt' for first-party staff tokens, 'api_key' for external sk_live_ keys,
   *  'oauth' for tokens minted by the MCP OAuth flow (Claude/ChatGPT connectors). */
  source: 'jwt' | 'api_key' | 'oauth';
  /**
   * The ONE site this credential may act on; null = the whole tenant
   * (docs/131 §3.2).
   *
   * Only `api_key` can currently carry one. A staff JWT is null because a
   * member's site access is a separate axis (`member_property_access`, §3.3)
   * resolved at the session layer, and an OAuth connector token is null because
   * the consent flow has no site step yet — both are recorded as null rather
   * than assumed unrestricted-forever.
   */
  propertyId: string | null;
}

interface InternalJwtPayload {
  sub: string;
  tid: string;
  role: Exclude<StaffRole, 'api'>;
  scopes?: McpScope[];
}

/** The MOST a staff role's JWT gets when the token carries no explicit `scopes`.
 *  Delegates to @sparx/auth's `grantableScopesForRole` rather than restating the
 *  policy — this table was previously hand-maintained here AND in the auth package,
 *  and the two drifted (see the McpScope note above). One policy, one place:
 *  owner/admin get everything, editor loses bulk + domain writes, viewer is
 *  read-only, and an API key has no role default (its scopes are exactly what the
 *  dashboard issued). */
const defaultScopesForRole = (role: StaffRole): McpScope[] => grantableScopesForRole(role);

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
    propertyId: verified.propertyId,
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
    // The OAuth consent flow has no site step yet, so a connector token reaches
    // the whole tenant. Explicit null rather than omitted — this is a gap to
    // close (docs/131 §3.2), not a decision that connectors are tenant-wide.
    propertyId: null,
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
  const granted = payload.scopes ?? defaultScopesForRole(payload.role);
  return {
    tenantId: payload.tid,
    userId: payload.sub,
    role: payload.role,
    scopes: new Set(granted),
    source: 'jwt',
    // A staff member's site access is its own axis (`member_property_access`,
    // docs/131 §3.3) resolved at the session layer, not carried on the token.
    propertyId: null,
  };
}

export class AuthError extends Error {
  readonly code = 'UNAUTHORIZED' as const;
  constructor(message: string) {
    super(message);
  }
}

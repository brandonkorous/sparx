// Internal-trust JWT + `sk_live_*` API-key verification.
//
// Token shape (JWT, issued by the dashboard for a logged-in user):
//   { sub: <user_id>, tid: <tenant_id>, role: <one of the org roles, StaffRole>,
//     ev: <email-verified bool>, iat, exp }
//   `ev` carries the Better Auth `emailVerified` flag so request handlers can
//   gate on it WITHOUT a DB read — the `users` table's RLS hides the row from
//   the non-owner `sparx_app` role services connect as (see
//   verified-email-guard.ts). The 5-minute token life keeps the claim fresh.
//
// API key shape (issued in /settings/ai-integrations, persisted in api_keys):
//   sk_live_<8 base32>_<32 base32>
//   Lookup by `keyPrefix` (sk_live_<8>); suffix SHA-256-compared to keyHash
//   with `crypto.timingSafeEqual`. Revoked + expired keys reject.
//
// Behaviour:
//   - No Authorization header → `request.auth` stays null. Routes that need
//     auth call `requireAuth(request)` to throw UNAUTHORIZED.
//   - `Authorization: Bearer <jwt>` valid → `request.auth.actorType = 'user'`.
//   - `Authorization: Bearer sk_live_*` valid → `request.auth.actorType = 'api'`.
//     API-key auth gets a fixed `role: 'editor'` for now; per-key scope
//     enforcement is a route-level concern (see MCP scope checks).
//   - `Authorization: Bearer <anything-else>` → UNAUTHORIZED.
//
// Service-agnostic: the plugin is built as a factory so each API service
// (api-rest, api-graphql, future api-mcp) supplies its own JWT secret + an
// optional list of public path prefixes that should skip Bearer validation.

import crypto from 'node:crypto';

import fastifyJwt from '@fastify/jwt';
import { prisma } from '@sparx/db';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { unauthorized, forbidden } from './errors.js';

const API_KEY_PUBLIC_PREFIX = 'sk_live_';
const API_KEY_PREFIX_LEN = API_KEY_PUBLIC_PREFIX.length + 8;

// The org-role vocabulary, hand-mirrored from @sparx/auth `ORG_ROLES` (kept in
// sync by hand — api-core stays fastify-only and must not import the Next/React
// graph @sparx/auth pulls in, same reason the api-key logic is inlined below).
// `owner|admin|editor|viewer` are the RANKED tier the coarse `requireRole`
// hierarchy understands; `builder|marketing|support|partner` are LATERAL
// capability roles — they floor to read-only in that hierarchy and earn their
// real powers from explicit `requireAnyRole` allow-lists on the routes that own
// them (e.g. `partner` → `/v1/partner/*`, docs/114 §B.7).
export type StaffRole =
  | 'owner'
  | 'admin'
  | 'editor'
  | 'builder'
  | 'marketing'
  | 'support'
  | 'partner'
  | 'viewer';
export type ActorType = 'user' | 'api';

export interface AuthContext {
  tenantId: string;
  actorId: string;
  actorType: ActorType;
  role: StaffRole;
  /**
   * Whether the actor's email is verified. Sourced from the session JWT `ev`
   * claim, NOT a live DB read — the `users` table's RLS returns no row for the
   * non-owner `sparx_app` role, so a fresh read would falsely report unverified.
   * API-key actors are always `true` (an issued key implies an established
   * tenant). Read by `requireVerifiedEmail`.
   */
  emailVerified: boolean;
  /**
   * The scopes granted to an API-key actor (e.g. `read:inventory`,
   * `write:inventory`), exactly as the dashboard issued them. Empty for `user`
   * (JWT) actors — staff are gated by `role`, not per-key scopes. Enforced by
   * `requireScope` on the documented public API surface (docs/06 §7).
   */
  scopes: string[];
  /**
   * WHICH SITES this actor may reach (docs/131 §3.2–3.3), as the RAW stored
   * shape. `null` = no restriction.
   *
   * Raw on purpose. api-core is deliberately fastify-only and must not import
   * `@sparx/auth` (see the note on the role vocabulary below), so it carries the
   * claim and the POLICY lives in `@sparx/auth/property-access` — the same split
   * that keeps `role` here and the role hierarchy there.
   *
   * Both credential kinds collapse onto one shape, which is the point: a staff
   * member restricted to two sites and an API key issued for one site become
   * the same `{ mode: 'selected', granted: [...] }`, so every consumer enforces
   * one thing rather than two. `mode` is a bare string for the same reason it is
   * in the policy module — the fail-closed branch there exists to handle a value
   * neither of us recognises.
   */
  propertyAccess: { mode: string; granted: string[] } | null;
}

interface InternalJwtPayload {
  sub: string;
  tid: string;
  role: StaffRole;
  // Email-verified flag (see AuthContext.emailVerified). Optional on the wire so
  // a token minted before this claim existed still verifies; absence → unverified.
  ev?: boolean;
  iat?: number;
  exp?: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

export interface AuthPluginOptions {
  jwtSecret: string;
  // Each consuming service has its own public/anonymous surface (health,
  // OpenAPI, signed-media URLs, etc). The plugin treats `request.url ===` for
  // the exact paths and `request.url.startsWith(prefix)` for prefixes.
  publicPaths?: string[];
  publicPrefixes?: string[];
}

const DEFAULT_PUBLIC_PATHS = ['/health'];

export function createAuthPlugin(options: AuthPluginOptions): FastifyPluginAsync {
  const publicPaths = new Set<string>([...DEFAULT_PUBLIC_PATHS, ...(options.publicPaths ?? [])]);
  const publicPrefixes = options.publicPrefixes ?? [];

  const authPlugin: FastifyPluginAsync = async (app) => {
    await app.register(fastifyJwt, {
      secret: options.jwtSecret,
      sign: { algorithm: 'HS256', expiresIn: '5m' },
      verify: { algorithms: ['HS256'] },
    });

    app.decorateRequest('auth', null);

    app.addHook('preHandler', async (request) => {
      if (publicPaths.has(request.url)) return;
      for (const prefix of publicPrefixes) {
        if (request.url.startsWith(prefix)) return;
      }

      const header = request.headers.authorization;
      if (!header) return;
      if (!header.startsWith('Bearer ')) return;

      const token = header.slice('Bearer '.length).trim();

      // `sk_live_*` tokens are API keys, not JWTs. Resolving them as JWTs
      // would just throw immediately on the `.` count check — short-circuit
      // to the api_keys lookup so the failure mode is "wrong key" vs
      // "malformed JWT".
      if (token.startsWith(API_KEY_PUBLIC_PREFIX)) {
        const apiKey = await verifyApiKeyToken(token);
        if (!apiKey) throw unauthorized('Invalid or expired API key.');
        request.auth = {
          tenantId: apiKey.tenantId,
          actorId: apiKey.actorId,
          actorType: 'api',
          // API keys ship with a fixed editor role; finer-grained scopes are
          // surfaced in `apiKey.scopes` and enforced at the route handler via
          // `requireScope`.
          role: 'editor',
          // An issued key implies an established tenant, so API actors are never
          // email-gated (requireVerifiedEmail also short-circuits non-user actors).
          emailVerified: true,
          scopes: apiKey.scopes,
          // A site-scoped key collapses onto the same shape a restricted member
          // uses, so downstream enforces ONE rule rather than two. A tenant-wide
          // key stays null — unrestricted, exactly as before.
          propertyAccess: apiKey.propertyId
            ? { mode: 'selected', granted: [apiKey.propertyId] }
            : null,
        };
        return;
      }

      let payload: InternalJwtPayload;
      try {
        payload = await request.jwtVerify<InternalJwtPayload>();
      } catch {
        throw unauthorized('Invalid or expired token.');
      }

      if (!payload.sub || !payload.tid) {
        throw unauthorized('Token is missing required claims.');
      }

      request.auth = {
        tenantId: payload.tid,
        actorId: payload.sub,
        actorType: 'user',
        role: payload.role,
        emailVerified: payload.ev ?? false,
        // Staff JWTs carry no per-key scopes — they're gated by `role`.
        scopes: [],
        // Read from the MEMBERSHIP rather than carried as a token claim. A grant
        // revoked in Settings → Team must bite without waiting for the token to
        // expire, and a claim minted at sign-in cannot do that.
        propertyAccess: await loadMemberPropertyAccess(payload.tid, payload.sub),
      };
    });
  };

  // fastify-plugin wrapper: the preHandler hook + request.auth decorator
  // must be visible to sibling route plugins. Without it, the auth hook
  // only runs on routes inside the same encapsulated scope.
  return fp(authPlugin, { name: 'auth', dependencies: ['envelope-errors'] });
}

// Route-handler helpers. Cheap to call repeatedly; throw the canonical
// ApiError so the envelope handler renders the right shape + status.

export function requireAuth(request: FastifyRequest): AuthContext {
  if (!request.auth) throw unauthorized();
  return request.auth;
}

// The ranked hierarchy the coarse `requireRole(min)` gate understands. LATERAL
// roles (builder/marketing/support/partner) are intentionally absent: they map to
// the read-only floor (rank 0) via the `?? 0` below, so a lateral role can never
// satisfy an editor/admin/owner gate by accident. (Historically an unranked role
// hit `undefined < n` === false and passed EVERY gate — a silent privilege
// escalation this floor closes.) Lateral roles get their real powers from the
// explicit `requireAnyRole` allow-lists on the routes that own them.
const ROLE_ORDER: Record<string, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

export function requireRole(request: FastifyRequest, min: StaffRole): AuthContext {
  const auth = requireAuth(request);
  if ((ROLE_ORDER[auth.role] ?? 0) < (ROLE_ORDER[min] ?? 0)) {
    throw forbidden(`Requires ${min} role or higher.`);
  }
  return auth;
}

/**
 * Explicit capability gate: the actor's role must be one of `allowed`. Unlike
 * `requireRole` (a ranked minimum), this is set-membership — the right tool for
 * LATERAL roles that don't fit the owner > admin > editor > viewer ladder. The
 * Partner Portal uses it to admit exactly {owner, admin, partner} to practice
 * operations (docs/114 §B.7) while denying editor/viewer/builder/marketing/support.
 */
export function requireAnyRole(
  request: FastifyRequest,
  allowed: readonly StaffRole[]
): AuthContext {
  const auth = requireAuth(request);
  if (!allowed.includes(auth.role)) {
    throw forbidden(`Requires one of these roles: ${allowed.join(', ')}.`);
  }
  return auth;
}

/**
 * Enforce an API-key scope on the documented public API surface (docs/06 §7,
 * docs/07 §5.2). `user` (JWT/dashboard) actors bypass — staff are gated by
 * `role`, and scopes are a per-API-key concept. An `api` actor must carry the
 * exact scope its key was issued with, else FORBIDDEN. Pair with `requireRole`
 * (the role gate still applies to both actor types).
 */
export function requireScope(request: FastifyRequest, scope: string): AuthContext {
  const auth = requireAuth(request);
  if (auth.actorType === 'api' && !auth.scopes.includes(scope)) {
    throw forbidden(`API key is missing the required scope "${scope}".`);
  }
  return auth;
}

// ─── api-key verification (sk_live_*) ──────────────────────────────────
//
// Inlined here rather than imported from `@sparx/auth` so api-core stays
// fastify-only (no Next/React peerDeps pulled into the service builds).
// Schema source: packages/db/prisma/schema/05-api-keys.prisma + canonical
// issuer at packages/auth/src/api-keys.ts — keep the hash/format logic in
// sync if either side changes.

interface VerifiedApiKey {
  tenantId: string;
  actorId: string;
  scopes: string[];
  /** The one site this key may act on; null = the whole tenant (docs/131 §3.2). */
  propertyId: string | null;
}

async function verifyApiKeyToken(token: string): Promise<VerifiedApiKey | null> {
  const lastUnderscore = token.lastIndexOf('_');
  if (lastUnderscore <= API_KEY_PUBLIC_PREFIX.length) return null;
  const prefix = token.slice(0, lastUnderscore);
  const suffix = token.slice(lastUnderscore + 1);
  if (prefix.length !== API_KEY_PREFIX_LEN) return null;
  if (suffix.length < 8) return null;

  const row = await prisma.apiKey.findUnique({ where: { keyPrefix: prefix } });
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

  const candidateHash = crypto.createHash('sha256').update(suffix, 'utf8').digest();
  const storedHash = Buffer.from(row.keyHash, 'hex');
  if (candidateHash.length !== storedHash.length) return null;
  if (!crypto.timingSafeEqual(candidateHash, storedHash)) return null;

  // Fire-and-forget last-used bump — never gate verification on the write.
  void prisma.apiKey
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return {
    tenantId: row.tenantId,
    actorId: row.createdByUserId ?? row.id,
    scopes: row.scopes,
    propertyId: row.propertyId,
  };
}

// ─── per-member site access (docs/131 §3.3) ────────────────────────────
//
// A staff member may be restricted to a subset of the tenant's sites, so the
// donut shop's order-taker cannot read the machine shop's customers. The
// restriction lives on the MEMBERSHIP (`members` + `member_property_access`),
// not the user — the same person can be unrestricted in one tenant and limited
// in another.
//
// Cached because this is a per-request read on a table that changes when
// somebody edits the team, i.e. approximately never. The TTL is deliberately
// short: a revoked grant that lingers for a minute is the cost of not opening a
// transaction on every authenticated request. Keyed by (tenant, user), so it is
// never a cross-tenant path.
const MEMBER_ACCESS_TTL_MS = 60_000;
const memberAccessCache = new Map<string, { at: number; value: AuthContext['propertyAccess'] }>();

async function loadMemberPropertyAccess(
  tenantId: string,
  userId: string
): Promise<AuthContext['propertyAccess']> {
  const key = `${tenantId}:${userId}`;
  const hit = memberAccessCache.get(key);
  if (hit && Date.now() - hit.at < MEMBER_ACCESS_TTL_MS) return hit.value;

  // `members` is ENABLE-but-not-FORCE RLS (an auth-layer table), so this reads
  // without a tenant GUC — deliberately, and the pair is filtered explicitly.
  const member = await prisma.member.findFirst({
    where: { organizationId: tenantId, userId },
    select: {
      propertyAccessMode: true,
      propertyAccess: { select: { propertyId: true } },
    },
  });

  // No membership row → no restriction to apply here. This is NOT a grant: the
  // caller already holds a valid tenant-scoped token, and every read is still
  // behind RLS plus the role gate. Failing closed on a missing row would lock
  // out legitimate actors (API keys have no member row at all).
  const value: AuthContext['propertyAccess'] =
    member && member.propertyAccessMode !== 'all'
      ? {
          mode: member.propertyAccessMode,
          granted: member.propertyAccess.map((row) => row.propertyId),
        }
      : null;

  memberAccessCache.set(key, { at: Date.now(), value });
  return value;
}

/** Drop cached site access for one member — call after a team edit so a revoked
 *  grant takes effect now rather than within the TTL. */
export function invalidateMemberAccessCache(tenantId: string, userId: string): void {
  memberAccessCache.delete(`${tenantId}:${userId}`);
}

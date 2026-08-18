// Tenant MCP API-key routes (docs/07 §5). Scoped `sk_live_*` keys for AI apps
// that cannot use the OAuth flow — the manual counterpart to a connected
// assistant. Every key carries a subset of the MCP scope catalog, capped by the
// ISSUING staffer's role (a viewer can never mint a write-capable key).
//
//   GET    /v1/ai/api-keys                → list the tenant's keys (admin)
//   POST   /v1/ai/api-keys                → issue one, returns the plaintext ONCE (admin)
//   DELETE /v1/ai/api-keys/:id            → revoke a key (admin)
//   GET    /v1/ai/api-keys/scope-catalog  → the scopes THIS role may grant (viewer)
//
// Deliberately NOT gated on the `ai` module — like the BYOK credential, an API
// key is account-wide access setup, not an AI feature, and the surface must be
// able to load and explain it before AI is turned on. Reads that expose key
// metadata are ADMIN (keys are security-sensitive); the scope catalog is a
// harmless vocabulary lookup, so it opens at viewer. Every write is ADMIN — the
// same bar as pasting a provider credential or changing a tool policy.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { badRequest } from '@wizeworks/api-core/errors';
import {
  issueApiKey,
  listApiKeys,
  revokeApiKey,
  MCP_SCOPE_CATALOG,
  grantableScopesForRole,
  type StaffRole,
} from '@wizeworks/auth';

const IssueBody = z.object({
  name: z.string().trim().min(1).max(120),
  // At least one scope — a key that can do nothing is a footgun, not a feature.
  scopes: z.array(z.string()).min(1),
  // ISO 8601 instant, or null/omitted for a key that never expires.
  expiresAt: z.string().datetime().nullable().optional(),
});

const IdParam = z.object({ id: z.string().uuid() });

/** Narrow api-core's wider role union (which carries lateral roles like
 *  `builder`/`marketing`) to the grant hierarchy `grantableScopesForRole` knows.
 *  Anything off that ladder floors to `viewer`, exactly as api-core's role-rank
 *  treats a lateral role — so a lateral actor can never grant a write scope. */
function grantingRole(role: string): StaffRole {
  return role === 'owner' || role === 'admin' || role === 'editor' || role === 'api'
    ? role
    : 'viewer';
}

/** The first requested scope the issuing role may NOT grant, or null if all are
 *  within reach — same rule the MCP OAuth consent page enforces, so a key can be
 *  scoped to any module the role can already reach and no further. */
function firstUngrantableScope(scopes: string[], role: StaffRole): string | null {
  const grantable = new Set<string>(grantableScopesForRole(role));
  for (const scope of scopes) {
    if (!grantable.has(scope)) return scope;
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; route registration is sync.
const aiApiKeyRoutes: FastifyPluginAsync = async (app) => {
  // The role-capped scope vocabulary the issue form renders. Viewer so the
  // surface can show what a key COULD carry even before anyone can create one.
  // Sync handler: a pure vocabulary lookup with no I/O. Fastify accepts a
  // non-async handler that returns a value just as happily as an async one.
  app.get('/v1/ai/api-keys/scope-catalog', (request) => {
    const auth = requireRole(request, 'viewer');
    const grantable = new Set<string>(grantableScopesForRole(grantingRole(auth.role)));
    return ok(MCP_SCOPE_CATALOG.filter((meta) => grantable.has(meta.scope)));
  });

  app.get('/v1/ai/api-keys', async (request) => {
    const auth = requireRole(request, 'admin');
    return ok(await listApiKeys(auth.tenantId));
  });

  app.post('/v1/ai/api-keys', async (request, reply) => {
    const auth = requireRole(request, 'admin');
    const body = IssueBody.parse(request.body);

    const bad = firstUngrantableScope(body.scopes, grantingRole(auth.role));
    // Defence in depth: the surface only offers grantable scopes, but a tampered
    // request must never mint access above the issuer's own role.
    if (bad) throw badRequest(`Your role cannot grant the "${bad}" permission.`);

    const issued = await issueApiKey({
      tenantId: auth.tenantId,
      name: body.name,
      scopes: body.scopes,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      createdByUserId: auth.actorId,
    });
    reply.code(201);
    // `plaintext` travels exactly once — the surface shows it and never asks for
    // it again, and it is never persisted anywhere we can hand back.
    return ok(issued);
  });

  app.delete('/v1/ai/api-keys/:id', async (request) => {
    const auth = requireRole(request, 'admin');
    const { id } = IdParam.parse(request.params);
    await revokeApiKey(auth.tenantId, id);
    return ok({ revoked: true });
  });
};

export default aiApiKeyRoutes;

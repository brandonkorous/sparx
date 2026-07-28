import type { FastifyRequest } from 'fastify';
import { isModuleEnabled } from '@sparx/auth';
import { requireAuth } from '@sparx/api-core/auth';
import { moduleDisabled } from '@sparx/api-core/errors';
import type { SocialContext } from '@sparx/social/service';
import { resolvePropertyId } from './property.js';

// Social posting is its own free, standalone module (docs/133 §1) — gated on `social`,
// NOT folded into commerce the way channels are.
//
// `SocialContext` (the pure {tenantId, userId} the service runs under) now lives in
// @sparx/social so REST + MCP share it; re-exported here so route imports of
// `./social-context.js` are unchanged. The Fastify request→context helpers stay here
// (the package must not depend on Fastify).

export type { SocialContext };

export function toSocialContext(request: FastifyRequest): SocialContext {
  const auth = requireAuth(request);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

/**
 * The site this request is working in — the header the site switcher sets, resolved
 * against what this actor may actually reach.
 *
 * Every social read is scoped through this. A connected account speaks for ONE business,
 * so a tenant running two of them must not see both sets of accounts pooled in one
 * unlabelled list — that is how a post lands on the wrong brand. Returns null when the
 * header is absent AND the tenant has no site to fall back to, in which case the reads
 * degrade to tenant-wide (the single-site behaviour).
 */
export async function resolveSocialProperty(request: FastifyRequest): Promise<string | null> {
  const auth = requireAuth(request);
  try {
    return await resolvePropertyId(
      auth,
      request.headers['x-sparx-property-id'] as string | undefined
    );
  } catch {
    // A tenant with no property row at all — pre-multi-site data. Tenant-wide is right.
    return null;
  }
}

export async function requireSocialModule(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  const enabled = await isModuleEnabled(auth.tenantId, 'social');
  if (!enabled) throw moduleDisabled('social');
}

// The tenant's INBOUND partner relationship (docs/114 §B.7) — "do I HAVE a Sparx
// partner", the mirror of the partner-practice routes at /v1/partner/*. A distinct
// path (/v1/tenant/partner) so the two never collide: this answers "who referred
// me", not "am I a partner". Owner/admin only — it's account-relationship info,
// and the consultant-access revoke it pairs with (dashboard Settings → Team) is an
// owner/admin membership action.
//
//   GET /v1/tenant/partner   → { referredBy: {...} | null }

import type { FastifyPluginAsync } from 'fastify';

import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';

import { partnerRelationshipService } from '../../lib/partners/relationship.js';

const tenantPartnerRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/tenant/partner', async (request) => {
    const auth = requireRole(request, 'admin');
    const relationship = await partnerRelationshipService.forReferredTenant(auth.tenantId);
    return ok(relationship);
  });

  return Promise.resolve();
};

export default tenantPartnerRoutes;

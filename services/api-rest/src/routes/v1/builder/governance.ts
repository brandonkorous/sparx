// Builder — tenant governance (docs/61 §8, Phase 6b), the brand-designer's safety
// policy over the builder.
//
//   GET /v1/builder/governance/allowlist  → platform base rules + the tenant's additions
//   PUT /v1/builder/governance/allowlist  → replace the tenant's additional block rules
//
// The utility ALLOWLIST. The platform base denylist (clickjacking / exfiltration /
// injection guards) is hardcoded in @sparx/surface-compile and NEVER relaxable —
// a tenant may only TIGHTEN. There is deliberately no "allow"/"unblock" field, so
// the insecure state is un-representable. Reads are viewer; writes are admin
// (owner satisfies it via the role hierarchy) — governance shapes what every
// editor on the tenant can compile. Module-gated like the rest of /v1/builder.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { governanceService } from '@sparx/builder';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireBuilderModule, toBuilderTenantContext } from '../../../lib/builder-context.js';

// A single tenant block rule. `value` is a literal class fragment — NOT a regex (a
// user-supplied regex is a ReDoS / footgun). Bounded charset + length so matching
// stays cheap and the value can't smuggle anything unexpected.
const Rule = z.object({
  kind: z.enum(['prefix', 'exact', 'substring']),
  value: z
    .string()
    .min(1)
    .max(64)
    .regex(
      /^[a-zA-Z0-9:._@/[\]-]+$/,
      'Use a plain class fragment (letters, digits, : . _ @ / [ ] -)'
    ),
});
// Full-replace (the list is small; replace is simpler than per-item merge). No
// "unblock" key — base rules live only in @sparx/surface-compile.
const PutAllowlist = z.object({ blocks: z.array(Rule).max(200) });

const builderGovernanceRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/builder/governance/allowlist', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    return ok(await governanceService.getAllowlist(toBuilderTenantContext(request)));
  });

  app.put('/v1/builder/governance/allowlist', async (request) => {
    requireRole(request, 'admin');
    await requireBuilderModule(request);
    const { blocks } = PutAllowlist.parse(request.body);
    return ok(await governanceService.setAllowlist(toBuilderTenantContext(request), blocks));
  });

  return Promise.resolve();
};

export default builderGovernanceRoutes;

// Email settings — sender identity, CAN-SPAM footer, brand fallback.
//
//   GET   /v1/email/settings   → this SITE's settings (defaults when unset)
//   PATCH /v1/email/settings   → update (partial)
//
// Both are per-site (docs/131 §3.4): the site is resolved from the switcher
// header through resolvePropertyId, so it is bounded by what this member may
// reach and never silently lands on a business they don't work for.

import type { FastifyPluginAsync } from 'fastify';
import { settingsService } from '@sparx/email-platform';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireEmailModule, toEmailContext } from '../../../lib/email-context.js';
import { resolvePropertyId } from '../../../lib/property.js';

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature.
const emailSettingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/email/settings', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireEmailModule(request);
    const propertyId = await resolvePropertyId(
      auth,
      request.headers['x-sparx-property-id'] as string | undefined
    );
    const settings = await settingsService.get(toEmailContext(request), propertyId);
    return ok(settings);
  });

  app.patch('/v1/email/settings', async (request) => {
    const auth = requireRole(request, 'editor');
    await requireEmailModule(request);
    const propertyId = await resolvePropertyId(
      auth,
      request.headers['x-sparx-property-id'] as string | undefined
    );
    const settings = await settingsService.update(
      toEmailContext(request),
      propertyId,
      request.body
    );
    return ok(settings);
  });
};

export default emailSettingsRoutes;

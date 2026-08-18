// Builder — draft-preview token mint (docs/45 §2.6, docs/47).
//
//   GET /v1/builder/preview-token → a short-lived tenant-scoped JWT
//
// Mirrors the legacy Site Builder mint (sitebuilder/publish.ts): a tenant-scoped
// `aud: site-preview` JWT that lets the PUBLIC site serve THIS tenant's DRAFT
// Builder page + draft Surface styles to the editor's "Preview" tab. No DB row
// (unlike CMS entry tokens) — the short TTL is the only control, and it exposes
// only the tenant's own draft. Verified by lib/preview.ts#tryVerifySitePreview.

import jwt from '@fastify/jwt';
import type { FastifyPluginAsync } from 'fastify';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireBuilderModule } from '../../../lib/builder-context.js';

void jwt; // keep the import — fastify-jwt type augmentation lives in plugins/auth.ts

// One editing session; short enough that no revocation row is needed (it is
// re-minted whenever the editor asks). Matches the Site Builder TTL.
const SITE_PREVIEW_TTL_SECONDS = 60 * 60;

const builderPreviewRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/builder/preview-token', async (request) => {
    const auth = requireRole(request, 'editor');
    await requireBuilderModule(request);
    const token = app.jwt.sign(
      { tid: auth.tenantId, aud: 'site-preview' },
      { expiresIn: SITE_PREVIEW_TTL_SECONDS }
    );
    return ok({ token, expires_in: SITE_PREVIEW_TTL_SECONDS });
  });

  return Promise.resolve();
};

export default builderPreviewRoutes;

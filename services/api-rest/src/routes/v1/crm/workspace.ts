// CRM workspace routes (docs/144 §11 + §12) — settings, saved views, meeting
// links, duplicate management, and the staff half of e-sign.
//
//   GET   /v1/crm/settings                          → what this business has decided
//   PATCH /v1/crm/settings                          → change it
//
//   GET    /v1/crm/saved-views?object_key=          → mine + the team's shared ones
//   POST   /v1/crm/saved-views                      → save one
//   PATCH  /v1/crm/saved-views/:id                  → change mine
//   DELETE /v1/crm/saved-views/:id                  → delete mine
//   POST   /v1/crm/saved-views/:id/duplicate        → take a copy of a shared one
//
//   GET    /v1/crm/meeting-links                    → the team's booking links
//   POST   /v1/crm/meeting-links                    → create one
//   PATCH  /v1/crm/meeting-links/:id                → change one
//   DELETE /v1/crm/meeting-links/:id                → retire one (archived, not gone)
//
//   GET    /v1/crm/duplicates                       → likely duplicates, most certain first
//   POST   /v1/crm/duplicates/bulk-merge            → merge everything above a confidence
//
//   GET    /v1/crm/documents/:id/signatures         → what has been asked of this document
//   POST   /v1/crm/documents/:id/signatures         → ask for a signature (returns the link ONCE)
//   POST   /v1/crm/signatures/:id/revoke            → stop a pending link working
//
// The PUBLIC half of e-sign — the page a customer actually signs on — is in
// routes/v1/public/documents.ts. It is separate because it is unauthenticated
// and resolves its tenant from the site, and mixing the two in one file is how
// an auth check gets forgotten on the route that most needs one.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  crmSettingsService,
  meetingLinkService,
  mergeService,
  savedViewService,
  signatureService,
} from '@sparx/crm';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { activeCrmSite, requireCrmModule, toCrmContext } from '../../../lib/crm-context.js';
import { sendSignatureRequest } from '../../../lib/signature-mail.js';

const PathId = z.object({ id: z.string().uuid() });

const ViewsQuery = z.object({
  object_key: z.string().max(63).optional(),
});

const DuplicatesQuery = z.object({
  limit: z.coerce.number().int().min(10).max(10_000).optional(),
});

const BulkMergeBody = z.object({
  /** No default: "destroy records without asking" has no sensible one. */
  minConfidence: z.number().int().min(50).max(100),
  limit: z.coerce.number().int().min(10).max(10_000).optional(),
});

const workspaceRoutes: FastifyPluginAsync = (app) => {
  /* ── Settings ─────────────────────────────────────────────────────────── */

  app.get('/v1/crm/settings', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const ctx = toCrmContext(request);
    const propertyId = await activeCrmSite(request);
    // The RESOLVED settings, not the stored row: a surface that renders the row
    // shows blanks for a tenant that has never saved, and a business reading
    // blanks concludes the feature is broken rather than defaulted.
    const settings = await crmSettingsService.crmSettings(ctx, propertyId);
    return ok(settings);
  });

  app.patch('/v1/crm/settings', async (request) => {
    requireRole(request, 'admin');
    await requireCrmModule(request);
    const ctx = toCrmContext(request);
    const propertyId = await activeCrmSite(request);
    const saved = await crmSettingsService.update(ctx, request.body, propertyId);
    return ok(saved);
  });

  /* ── Saved views ──────────────────────────────────────────────────────── */

  app.get('/v1/crm/saved-views', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = ViewsQuery.parse(request.query);
    const propertyId = await activeCrmSite(request);
    const items = await savedViewService.list(toCrmContext(request), {
      objectKey: q.object_key,
      propertyId,
    });
    return paged(items, { total: items.length, per_page: items.length || 1 });
  });

  app.post('/v1/crm/saved-views', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const view = await savedViewService.create(toCrmContext(request), request.body);
    reply.code(201);
    return ok(view);
  });

  app.patch('/v1/crm/saved-views/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await savedViewService.update(toCrmContext(request), id, request.body));
  });

  app.delete('/v1/crm/saved-views/:id', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    await savedViewService.remove(toCrmContext(request), id);
    reply.code(204);
  });

  app.post('/v1/crm/saved-views/:id/duplicate', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const body = z.object({ name: z.string().max(120).optional() }).parse(request.body ?? {});
    const view = await savedViewService.duplicate(toCrmContext(request), id, body.name);
    reply.code(201);
    return ok(view);
  });

  /* ── Meeting links ────────────────────────────────────────────────────── */

  app.get('/v1/crm/meeting-links', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const propertyId = await activeCrmSite(request);
    const items = await meetingLinkService.list(toCrmContext(request), { propertyId });
    return paged(items, { total: items.length, per_page: items.length || 1 });
  });

  app.post('/v1/crm/meeting-links', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const link = await meetingLinkService.create(toCrmContext(request), request.body);
    reply.code(201);
    return ok(link);
  });

  app.patch('/v1/crm/meeting-links/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await meetingLinkService.update(toCrmContext(request), id, request.body));
  });

  app.delete('/v1/crm/meeting-links/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    // 200 with the archived row, not 204: the link still exists and the surface
    // wants to show it as retired rather than make it vanish mid-list.
    return ok(await meetingLinkService.archive(toCrmContext(request), id));
  });

  /* ── Duplicates ───────────────────────────────────────────────────────── */

  app.get('/v1/crm/duplicates', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = DuplicatesQuery.parse(request.query);
    const propertyId = await activeCrmSite(request);
    const groups = await mergeService.findLikelyDuplicates(toCrmContext(request), {
      limit: q.limit,
      propertyId,
    });
    return paged(groups, { total: groups.length, per_page: groups.length || 1 });
  });

  app.post('/v1/crm/duplicates/bulk-merge', async (request) => {
    // Admin, like the single merge it calls. A bulk merge is the single most
    // destructive thing in the CRM and it runs without anyone looking at a row.
    requireRole(request, 'admin');
    await requireCrmModule(request);
    const body = BulkMergeBody.parse(request.body);
    const propertyId = await activeCrmSite(request);
    const result = await mergeService.bulkMerge(toCrmContext(request), {
      minConfidence: body.minConfidence,
      limit: body.limit,
      propertyId,
    });
    return ok(result);
  });

  /* ── E-sign, staff side ───────────────────────────────────────────────── */

  app.get('/v1/crm/documents/:id/signatures', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const items = await signatureService.listForDocument(toCrmContext(request), id);
    return paged(items, { total: items.length, per_page: items.length || 1 });
  });

  app.post('/v1/crm/documents/:id/signatures', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    const ctx = toCrmContext(request);
    const { signature, token, notify } = await signatureService.request(ctx, id, request.body);

    const link = await sendSignatureRequest(request, {
      documentId: id,
      signature,
      token,
      notify,
    });

    reply.code(201);
    // THE ONLY TIME THE LINK EXISTS. It is not stored and cannot be re-issued —
    // a caller who loses it asks again, which mints a new one and revokes this.
    // Said in the response body rather than only in a doc, because the person
    // integrating against this is reading the response.
    return ok({ signature, signingUrl: link, emailed: notify });
  });

  app.post('/v1/crm/signatures/:id/revoke', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await signatureService.revoke(toCrmContext(request), id));
  });
  return Promise.resolve();
};

export default workspaceRoutes;

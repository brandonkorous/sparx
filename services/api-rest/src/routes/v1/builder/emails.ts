// Builder — the Email Builder catalog and draft/publish lifecycle (docs/52).
// Mirrors the page catalog (pages.ts); an email is ONE self-contained body tree.
//
//   GET    /v1/builder/emails              → list the tenant's emails (seeds the
//                                            curated starter set on first call)
//   POST   /v1/builder/emails              → create an email (from a tree or blank)
//   POST   /v1/builder/emails/reorder      → reorder the catalog
//   GET    /v1/builder/emails/:id          → one email
//   PATCH  /v1/builder/emails/:id          → rename / set subject·preheader / save tree
//   DELETE /v1/builder/emails/:id          → remove
//   POST   /v1/builder/emails/:id/publish  → snapshot draft → published
//   GET    /v1/builder/emails/:id/preview  → render the DRAFT body to inlined HTML
//   POST   /v1/builder/emails/:id/test-send→ render the draft + queue delivery via
//                                            email-worker (the single egress path)
//
// Bodies are validated by the service-layer Zod schemas (the established route ↔
// service boundary), so api-rest keeps no @sparx/builder-schemas dependency. The
// render path loads the tree here (@sparx/builder) and injects it into
// @sparx/email-platform's builderEmailService — keeping that package free of a
// @sparx/builder dependency (docs/52 §6, the section-resolver injection pattern).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { emailService } from '@sparx/builder';
import { builderEmailService } from '@sparx/email-platform';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { publish } from '@sparx/api-core/pubsub';
import {
  requireBuilderModule,
  toBuilderContext,
  toBuilderTenantContext,
} from '../../../lib/builder-context.js';
import { requireTenantProperty } from '../../../lib/property.js';
import { emailDataResolver } from '../../../lib/email-data.js';

const IdParam = z.object({ id: z.string().uuid() });
const PropertyParam = z.object({ propertyId: z.string().uuid() });
const CustomizeBody = z.object({ key: z.string().min(1).max(63) });

const builderEmailRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/builder/emails', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const emails = await emailService.listOrSeed(toBuilderTenantContext(request));
    return ok({ emails });
  });

  app.post('/v1/builder/emails', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const email = await emailService.create(toBuilderTenantContext(request), request.body);
    return ok(email);
  });

  // ── Per-site email authoring (docs/49 Phase 7b, docs/91 §6) ──────────────────
  // A SITE's view of the catalog: the tenant-wide rows (13 defaults + tenant
  // custom emails) with each default REPLACED by this site's override when one
  // exists, plus the site's own custom emails. `requireTenantProperty` fails
  // closed (404) on a foreign/unknown property id — unlike the header-scoped
  // resolvePropertyId, an explicit path target must never silently fall back to
  // the primary site.
  app.get('/v1/builder/emails/site/:propertyId', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const ctx = toBuilderTenantContext(request);
    const { propertyId } = PropertyParam.parse(request.params);
    await requireTenantProperty(ctx.tenantId, propertyId);
    const emails = await emailService.listForProperty(ctx, propertyId);
    return ok({ emails });
  });

  // "Customize for this site": fork a tenant-wide default into a per-site DRAFT
  // override the site edits independently. Idempotent — a repeat returns the
  // existing override. The tenant default keeps sending for the site until the
  // override is published (getPublishedByKey's per-site fallback).
  app.post('/v1/builder/emails/site/:propertyId/customize', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const ctx = toBuilderTenantContext(request);
    const { propertyId } = PropertyParam.parse(request.params);
    const { key } = CustomizeBody.parse(request.body);
    await requireTenantProperty(ctx.tenantId, propertyId);
    const email = await emailService.customizeForSite(ctx, key, propertyId);
    return ok(email);
  });

  app.post('/v1/builder/emails/reorder', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const emails = await emailService.reorder(toBuilderTenantContext(request), request.body);
    return ok({ emails });
  });

  app.get('/v1/builder/emails/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    const email = await emailService.get(toBuilderTenantContext(request), id);
    return ok(email);
  });

  app.patch('/v1/builder/emails/:id', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    const email = await emailService.update(toBuilderTenantContext(request), id, request.body);
    return ok(email);
  });

  app.delete('/v1/builder/emails/:id', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    await emailService.remove(toBuilderTenantContext(request), id);
    return ok({ id });
  });

  app.post('/v1/builder/emails/:id/publish', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    const email = await emailService.publish(toBuilderTenantContext(request), id);
    return ok(email);
  });

  // Render the DRAFT body to inlined HTML + plain text for the editor preview.
  // `emailService.get` returns the draft tree (and throws a mapped 404 if the
  // email doesn't exist); builderEmailService resolves the brand + renders. We use
  // the per-PROPERTY ctx (the active site from the `x-sparx-property-id` header)
  // and pass its propertyId so the preview paints the SAME per-site brand the real
  // send does (docs/49 Phase 7) — emails themselves stay tenant-wide, only the
  // brand resolution is site-scoped, matching the editor canvas.
  app.get('/v1/builder/emails/:id/preview', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const ctx = await toBuilderContext(request);
    const { id } = IdParam.parse(request.params);
    const email = await emailService.get(ctx, id);
    const preview = await builderEmailService.renderPreview(
      ctx,
      { tree: email.tree, subject: email.subject, preheader: email.preheader },
      emailDataResolver(ctx, ctx.propertyId),
      ctx.propertyId
    );
    return ok(preview);
  });

  // Staff smoke test: render the DRAFT here, then hand delivery to the
  // email-worker via an `email.send` event. Email egress goes through the worker
  // (Mailgun in prod) — direct provider sends are an OTP-only escape hatch
  // (CLAUDE.md). The worker delivers the pre-rendered `raw` body as-is.
  app.post('/v1/builder/emails/:id/test-send', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    // Per-PROPERTY ctx (active site) so the test copy is branded EXACTLY as a real
    // send for that site — the same per-site brand as the preview + canvas (docs/49).
    const ctx = await toBuilderContext(request);
    const { id } = IdParam.parse(request.params);
    const email = await emailService.get(ctx, id);
    const prepared = await builderEmailService.prepareTestSend(
      ctx,
      { tree: email.tree, subject: email.subject, preheader: email.preheader },
      request.body,
      emailDataResolver(ctx, ctx.propertyId),
      ctx.propertyId
    );
    await publish(request.log, 'email.send', ctx.tenantId, null, {
      kind: 'raw',
      to: prepared.to,
      from: prepared.from,
      ...(prepared.replyTo ? { replyTo: prepared.replyTo } : {}),
      subject: prepared.subject,
      html: prepared.html,
      text: prepared.text,
      variables: { test_send: 'true' },
    });
    return ok({ queued: true, to: prepared.to });
  });

  return Promise.resolve();
};

export default builderEmailRoutes;

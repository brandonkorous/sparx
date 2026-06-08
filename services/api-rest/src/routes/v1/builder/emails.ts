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
import { requireBuilderModule, toBuilderTenantContext } from '../../../lib/builder-context.js';
import { emailDataResolver } from '../../../lib/email-data.js';

const IdParam = z.object({ id: z.string().uuid() });

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
  // email doesn't exist); builderEmailService resolves the brand + renders.
  app.get('/v1/builder/emails/:id/preview', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const ctx = toBuilderTenantContext(request);
    const { id } = IdParam.parse(request.params);
    const email = await emailService.get(ctx, id);
    const preview = await builderEmailService.renderPreview(
      ctx,
      { tree: email.tree, subject: email.subject, preheader: email.preheader },
      emailDataResolver(ctx)
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
    const ctx = toBuilderTenantContext(request);
    const { id } = IdParam.parse(request.params);
    const email = await emailService.get(ctx, id);
    const prepared = await builderEmailService.prepareTestSend(
      ctx,
      { tree: email.tree, subject: email.subject, preheader: email.preheader },
      request.body,
      emailDataResolver(ctx)
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

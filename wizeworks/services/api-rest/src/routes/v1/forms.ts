// Site forms — the authenticated submissions inbox (docs/115).
//
//   GET    /v1/forms/definitions        → every form on this site, for a picker
//   GET    /v1/forms/definitions/:id    → one form's settings
//   PUT    /v1/forms/definitions/:id    → save one form's settings
//   GET    /v1/forms/submissions        → list (tenant-wide, newest first) + counts
//   GET    /v1/forms/submissions/:id    → one submission
//   GET    /v1/forms/submissions/:id/attachments/:index → download an attachment
//   PATCH  /v1/forms/submissions/:id    → set status (read | spam | archived | new)
//   DELETE /v1/forms/submissions/:id    → remove
//
// Gated on the `builder` module (forms are a site-builder feature). The public
// SUBMIT endpoint lives at routes/v1/public/forms.ts and is unauthenticated.
//
// Attachment download (docs/115 Part D): the bytes live in the PRIVATE bucket and
// are NEVER world-readable (no public URL, and the app SA can't V4-sign a private
// GET under Workload Identity). Staff pull them through this authenticated,
// RLS-scoped route — api-rest reads the object and pipes it with a `Content-
// Disposition: attachment` so the browser downloads rather than renders it.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { formDefinitionService, formService } from '@wizeworks/builder';
import { ok } from '@wizeworks/api-core/envelope';
import { badRequest, notFound } from '@wizeworks/api-core/errors';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireBuilderModule, toBuilderContext } from '../../lib/builder-context.js';
import { getStorage } from '../../lib/storage.js';

const IdParam = z.object({ id: z.string().uuid() });
const AttachmentParams = z.object({
  id: z.string().uuid(),
  index: z.coerce.number().int().min(0).max(99),
});
const ListQuery = z.object({
  status: z.string().max(20).optional(),
  formNodeId: z.string().max(255).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
const StatusBody = z.object({ status: z.string().max(20) });

// The inbox exposes an attachment's display metadata but NEVER its private storage
// key — the key stays server-side (the download route addresses attachments by
// index, not key), so a browser DTO can't leak the object layout. Reshape each row
// so `attachments` carries only { filename, mimeType, byteSize }.
function stripAttachmentKeys<T extends object>(row: T): T {
  const attachments = formService
    .parseFormAttachments((row as { attachments?: unknown }).attachments)
    .map(({ filename, mimeType, byteSize }) => ({ filename, mimeType, byteSize }));
  return { ...row, attachments };
}

// A form's routing settings, addressed by its silica node id. This is the ONLY way
// recipients are ever written, and it is authenticated + editor-role + module-gated.
// The public submit endpoint READS this row and never writes it, so no address can
// ever originate from a visitor.
const FormNodeParam = z.object({ formNodeId: z.string().min(1).max(255) });
const SaveFormBody = z.object({
  pageSlug: z.string().max(255).nullish(),
  // Parsed as real addresses here, at the trust boundary — the service stores what it
  // is given, so this is where a malformed or injected recipient gets refused.
  recipients: z.array(z.string().email().max(255)).max(20).default([]),
  // Bounded, but PARTIAL: the service normalizes and fills every field, so a client
  // that omits one (or predates it) still saves a complete config rather than 400ing.
  config: z
    .object({
      name: z.string().max(120),
      successMessage: z.string().max(1000),
      notify: z.boolean(),
      addToCrm: z.boolean(),
      openDeal: z.boolean(),
      autoresponder: z.boolean(),
      autoresponderSubject: z.string().max(255),
      autoresponderMessage: z.string().max(4000),
    })
    .partial()
    .default({}),
});

const formsRoutes: FastifyPluginAsync = (app) => {
  // ── A silica form's settings (docs/115) ────────────────────────────────────
  // Every form on this site, for choosing what a campaign counts (docs/152 G2).
  // Registered BEFORE `/:formNodeId` — Fastify's router prefers the static
  // segment either way, but keeping the specific route above the parameterised
  // one is what makes that obvious to the next person reading the file.
  app.get('/v1/forms/definitions', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const ctx = await toBuilderContext(request);
    return ok({ forms: await formDefinitionService.listForms(ctx) });
  });

  app.get('/v1/forms/definitions/:formNodeId', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { formNodeId } = FormNodeParam.parse(request.params);
    const ctx = await toBuilderContext(request);
    return ok(await formDefinitionService.getSilicaForm(ctx, formNodeId));
  });

  app.put('/v1/forms/definitions/:formNodeId', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { formNodeId } = FormNodeParam.parse(request.params);
    const body = SaveFormBody.parse(request.body);
    const ctx = await toBuilderContext(request);
    return ok(
      await formDefinitionService.saveSilicaForm(ctx, formNodeId, {
        pageSlug: body.pageSlug ?? null,
        recipients: body.recipients,
        config: body.config,
      })
    );
  });

  app.get('/v1/forms/submissions', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const q = ListQuery.parse(request.query);
    const ctx = await toBuilderContext(request);
    const [submissions, counts, forms] = await Promise.all([
      formService.listSubmissions(ctx, q),
      formService.submissionCounts(ctx),
      formService.submissionForms(ctx),
    ]);
    return ok({ submissions: submissions.map(stripAttachmentKeys), counts, forms });
  });

  app.get('/v1/forms/submissions/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    const submission = await formService.getSubmission(await toBuilderContext(request), id);
    return ok(stripAttachmentKeys(submission));
  });

  app.get('/v1/forms/submissions/:id/attachments/:index', async (request, reply) => {
    requireRole(request, 'viewer');
    await requireBuilderModule(request);
    const { id, index } = AttachmentParams.parse(request.params);
    // Load under RLS — a submission id can't reach another tenant's attachment.
    const submission = await formService.getSubmission(await toBuilderContext(request), id);
    const attachments = formService.parseFormAttachments(
      (submission as { attachments?: unknown }).attachments
    );
    const att = attachments[index];
    if (!att) throw notFound('Attachment', String(index));

    const obj = await getStorage()
      .readObject(att.key)
      .catch(() => null);
    if (!obj) throw notFound('Attachment', att.filename);

    // Force a download (never inline-render an untrusted upload); the filename is
    // already sanitized to [\w.-], so it's safe in the header value.
    const contentType =
      [att.mimeType, obj.contentType].find((t) => t != null && t.length > 0) ??
      'application/octet-stream';
    reply
      .header('content-type', contentType)
      .header('content-disposition', `attachment; filename="${att.filename}"`)
      .header('cache-control', 'private, no-store');
    if (obj.size !== null) reply.header('content-length', String(obj.size));
    return reply.send(obj.body);
  });

  app.patch('/v1/forms/submissions/:id', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    const { status } = StatusBody.parse(request.body);
    if (!formService.isSubmissionStatus(status)) throw badRequest('Invalid status.');
    const submission = await formService.setSubmissionStatus(
      await toBuilderContext(request),
      id,
      status
    );
    return ok(submission);
  });

  app.delete('/v1/forms/submissions/:id', async (request) => {
    requireRole(request, 'editor');
    await requireBuilderModule(request);
    const { id } = IdParam.parse(request.params);
    await formService.deleteSubmission(await toBuilderContext(request), id);
    return ok({ id });
  });

  return Promise.resolve();
};

export default formsRoutes;

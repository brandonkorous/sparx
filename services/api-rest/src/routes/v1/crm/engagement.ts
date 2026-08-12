// The engagement spine — what was said (docs/144 §5).
//
//   GET    /v1/crm/engagement/threads            → conversations on a record
//   GET    /v1/crm/engagement/threads/:id        → one, with its messages
//   POST   /v1/crm/engagement/emails             → email one person
//   POST   /v1/crm/engagement/calls              → log a call
//   POST   /v1/crm/engagement/notes              → write a note
//   POST   /v1/crm/engagement/inbound            → record an inbound message
//
//   GET/POST/DELETE /v1/crm/mailboxes[/:id]      → connected mailboxes
//   GET    /v1/crm/mailboxes/sendable            → which ones THIS person may use
//   POST   /v1/crm/mailboxes/:id/sync            → check for new mail now
//
//   GET/POST/PATCH/DELETE /v1/crm/sales-templates[/:id]
//   GET    /v1/crm/sales-templates/performance   → which ones get replies
//   POST   /v1/crm/sales-templates/:id/restore   → take one back out
//   GET/POST/PATCH/DELETE /v1/crm/sales-snippets[/:id]
//   POST   /v1/crm/sales-snippets/:id/used       → count an expansion
//
// `/inbound` is the mail sync's own door and is deliberately EDITOR-gated rather
// than public: the sync runs inside the cluster with a service credential. A
// public webhook here would let anyone write into a tenant's timeline.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { engagementService, mailboxService, salesTemplateService } from '@sparx/crm';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';

import { requireCrmModule, toCrmContext } from '../../../lib/crm-context.js';
import { connectMailbox, syncMailbox } from '../../../lib/crm-mailbox-sync.js';

const IdPath = z.object({ id: z.string().uuid() });

/**
 * What connecting a mailbox needs.
 *
 * The full validation lives in `ConnectMailboxInput` (@sparx/crm-schemas) and
 * runs inside the service; this is the shape the ROUTE needs before it can
 * attempt a login, which happens before anything is stored.
 */
const ConnectBody = z.object({
  emailAddress: z.string().trim().toLowerCase().email().max(320),
  /** An app password, not the account password — see the schema for why. */
  appPassword: z.string().min(1).max(512),
  imapHost: z.string().min(3).max(255),
  imapPort: z.number().int().min(1).max(65_535).optional(),
  smtpHost: z.string().min(3).max(255),
  smtpPort: z.number().int().min(1).max(65_535).optional(),
  imapUser: z.string().max(320).optional(),
  scope: z.enum(['personal', 'shared']).default('personal'),
  displayName: z.string().max(255).nullable().optional(),
  propertyId: z.string().uuid().nullable().optional(),
});

const ThreadQuery = z.object({
  customer_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  ticket_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
});

const TemplateQuery = z.object({
  folder: z.string().max(120).optional(),
  include_archived: z.coerce.boolean().optional(),
});

const engagementRoutes: FastifyPluginAsync = (app) => {
  /* ── Conversations ────────────────────────────────────────────────────── */

  app.get('/v1/crm/engagement/threads', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = ThreadQuery.parse(request.query);
    const items = await engagementService.listThreads(toCrmContext(request), {
      customerId: q.customer_id,
      dealId: q.deal_id,
      ticketId: q.ticket_id,
      take: q.take,
    });
    return paged(items, { total: items.length, per_page: items.length });
  });

  app.get('/v1/crm/engagement/threads/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await engagementService.getThread(toCrmContext(request), id));
  });

  /* ── Saying something ─────────────────────────────────────────────────── */

  app.post('/v1/crm/engagement/emails', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const sent = await engagementService.sendEmail(toCrmContext(request), request.body);
    return reply.code(201).send(ok(sent));
  });

  app.post('/v1/crm/engagement/calls', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const logged = await engagementService.logCall(toCrmContext(request), request.body);
    return reply.code(201).send(ok(logged));
  });

  app.post('/v1/crm/engagement/notes', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const logged = await engagementService.logNote(toCrmContext(request), request.body);
    return reply.code(201).send(ok(logged));
  });

  // The mail sync's door. Returns 200 with an outcome rather than an error for a
  // duplicate or an unknown contact — both are NORMAL, and a sync that treated
  // them as failures would retry forever.
  app.post('/v1/crm/engagement/inbound', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    return ok(await engagementService.recordInbound(toCrmContext(request), request.body));
  });

  /* ── Mailboxes ────────────────────────────────────────────────────────── */

  app.get('/v1/crm/mailboxes', async (request) => {
    requireRole(request, 'admin');
    await requireCrmModule(request);
    const items = await mailboxService.list(toCrmContext(request));
    return paged(items, { total: items.length, per_page: items.length });
  });

  // Viewer, not admin: every rep needs to know what they can send from, and this
  // returns only their own plus the shared addresses.
  app.get('/v1/crm/mailboxes/sendable', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireCrmModule(request);
    const items = auth.actorId
      ? await mailboxService.sendableBy(toCrmContext(request), auth.actorId)
      : [];
    return paged(items, { total: items.length, per_page: items.length });
  });

  // Connecting VERIFIES the credentials before storing them, so a wrong server
  // name or an account password used where an app password was needed is
  // reported while the person is still looking at the form.
  app.post('/v1/crm/mailboxes', async (request, reply) => {
    const auth = requireRole(request, 'admin');
    await requireCrmModule(request);
    const input = ConnectBody.parse(request.body);
    const connected = await connectMailbox(toCrmContext(request), {
      ...input,
      // A personal mailbox belongs to the person connecting it. Letting a caller
      // name someone else would be connecting a colleague's mailbox for them —
      // and then sending as them.
      userId: input.scope === 'shared' ? null : auth.actorId,
    });
    return reply.code(201).send(ok(connected));
  });

  // Poll one mailbox now rather than waiting for the tick. What "Check for new
  // mail" is wired to, and what someone reaches for the moment they suspect the
  // connection has stopped working.
  app.post('/v1/crm/mailboxes/:id/sync', async (request) => {
    requireRole(request, 'admin');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    const ctx = toCrmContext(request);
    // Confirms the mailbox belongs to this tenant before any I/O — the sync
    // itself reports failures on the row rather than throwing.
    await mailboxService.get(ctx, id);
    return ok(await syncMailbox(request.log, ctx.tenantId, id));
  });

  app.delete('/v1/crm/mailboxes/:id', async (request) => {
    requireRole(request, 'admin');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    await mailboxService.disconnect(toCrmContext(request), id);
    return ok({ disconnected: true });
  });

  /* ── Templates ────────────────────────────────────────────────────────── */

  app.get('/v1/crm/sales-templates', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = TemplateQuery.parse(request.query);
    const items = await salesTemplateService.listTemplates(toCrmContext(request), {
      // Scoped to the caller, so a colleague's private draft never leaves the
      // database rather than being filtered out on the client.
      userId: auth.actorId ?? undefined,
      folder: q.folder,
      includeArchived: q.include_archived,
    });
    return paged(items, { total: items.length, per_page: items.length });
  });

  app.get('/v1/crm/sales-templates/performance', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const items = await salesTemplateService.templatePerformance(toCrmContext(request));
    return paged(items, { total: items.length, per_page: items.length });
  });

  app.post('/v1/crm/sales-templates', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const created = await salesTemplateService.createTemplate(toCrmContext(request), request.body);
    return reply.code(201).send(ok(created));
  });

  app.patch('/v1/crm/sales-templates/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await salesTemplateService.updateTemplate(toCrmContext(request), id, request.body));
  });

  app.delete('/v1/crm/sales-templates/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await salesTemplateService.archiveTemplate(toCrmContext(request), id));
  });

  // The way back. Archiving is one press and hides a template from every picker
  // in the business, so without this a mis-click costs the message itself —
  // and retyping it under a new name orphans the counters that made it worth
  // keeping.
  app.post('/v1/crm/sales-templates/:id/restore', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await salesTemplateService.restoreTemplate(toCrmContext(request), id));
  });

  /* ── Snippets ─────────────────────────────────────────────────────────── */

  app.get('/v1/crm/sales-snippets', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireCrmModule(request);
    const items = await salesTemplateService.listSnippets(toCrmContext(request), {
      userId: auth.actorId ?? undefined,
    });
    return paged(items, { total: items.length, per_page: items.length });
  });

  app.post('/v1/crm/sales-snippets', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const created = await salesTemplateService.createSnippet(toCrmContext(request), request.body);
    return reply.code(201).send(ok(created));
  });

  app.patch('/v1/crm/sales-snippets/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await salesTemplateService.updateSnippet(toCrmContext(request), id, request.body));
  });

  // A shortcut was just expanded into a message. Counting it is what lets the
  // list put the paragraphs people actually reach for at the top — the service
  // has always been able to record it and nothing could ask.
  app.post('/v1/crm/sales-snippets/:id/used', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    await salesTemplateService.noteSnippetUsed(toCrmContext(request), id);
    return ok({ counted: true });
  });

  app.delete('/v1/crm/sales-snippets/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    await salesTemplateService.deleteSnippet(toCrmContext(request), id);
    return ok({ deleted: true });
  });

  // No top-level await in this plugin, but the FastifyPluginAsync contract wants
  // a promise — the same explicit resolve every sibling route file ends with.
  return Promise.resolve();
};

export default engagementRoutes;

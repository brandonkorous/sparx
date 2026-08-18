// Authed legal-pages management (docs/42 §3.5). Backs the dashboard CMS
// "Legal" surface:
//
//   GET    /v1/legal/checklist          → completeness over the legal registry
//   POST   /v1/legal/pages              → instantiate a starter template → draft
//   GET    /v1/legal/placements         → footer doc placements (for management)
//   POST   /v1/legal/placements         → wire an existing page into the footer
//   PATCH  /v1/legal/placements/:id     → reorder / enable / relabel
//   DELETE /v1/legal/placements/:id     → remove a placement
//
// Editing + publishing a legal page reuses the existing /v1/content/entries
// routes verbatim — a legal page is just a `page` entry with legal_kind set.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { serializeEntry, getLegalChecklistTx, createLegalPageTx } from '@wizeworks/cms';
import { writeAudit } from '@wizeworks/api-core/audit';
import { publish } from '@wizeworks/api-core/pubsub';
import { conflict, notFound } from '@wizeworks/api-core/errors';
import { LEGAL_KINDS, type LegalKind } from '@wizeworks/legal-templates';
import { resolvePropertyId, type SiteActor } from '../../lib/property.js';

/** The active site (docs/49 Phase 6c) — the `x-sparx-property-id` the dashboard
 *  switcher sets, else the tenant's primary. Drives which site's placements the
 *  manager reflects. */
function activeProperty(request: FastifyRequest, actor: SiteActor) {
  const requested = request.headers['x-sparx-property-id'];
  return resolvePropertyId(actor, typeof requested === 'string' ? requested : null);
}

const legalRoutes: FastifyPluginAsync = (app) => {
  // ── Checklist ───────────────────────────────────────────────────────────
  app.get('/v1/legal/checklist', async (request) => {
    const auth = requireRole(request, 'viewer');
    const result = await withRequestTenant(request, (tx) => getLegalChecklistTx(tx, auth.tenantId));
    return ok(result);
  });

  // ── Instantiate a starter template → draft page (+ footer placement) ──────
  // The instantiation logic lives in @wizeworks/cms's legal-service (createLegalPageTx), so
  // the MCP `create_legal_page` tool scaffolds a draft through the exact same path.
  app.post('/v1/legal/pages', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    const { legalKind } = z
      .object({ legalKind: z.enum(LEGAL_KINDS as unknown as [LegalKind, ...LegalKind[]]) })
      .parse(request.body);

    const { entry, events } = await withRequestTenant(request, async (tx) => {
      const result = await createLegalPageTx(
        tx,
        { tenantId: auth.tenantId, actorId: auth.actorId },
        legalKind
      );
      await writeAudit(tx, request, auth, {
        action: 'content.entry.created',
        entityType: 'content_entry',
        entityId: result.entry.id,
        after: {
          typeKey: result.entry.typeKey,
          slug: result.entry.slug,
          legalKind: result.entry.legalKind,
        },
      });
      return result;
    });

    for (const ev of events) {
      await publish(request.log, ev.type, auth.tenantId, auth.actorId, ev.data);
    }

    reply.code(201);
    return ok(serializeEntry(entry));
  });

  // ── Acknowledge the starter-text disclaimer (docs/42 §3.4) ────────────────
  // Clears the "unreviewed starter text" badge by stamping
  // legal_disclaimer_ack_at. One-way + idempotent: re-acknowledging a page that
  // is already acknowledged is a no-op, never an error.
  app.post('/v1/legal/pages/:id/acknowledge', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const result = await withRequestTenant(request, async (tx) => {
      const entry = await tx.contentEntry.findFirst({
        where: { id, typeKey: 'page', legalKind: { not: null }, deletedAt: null },
        select: { id: true, legalKind: true, legalDisclaimerAckAt: true },
      });
      if (!entry) throw notFound('Legal page', id);
      if (entry.legalDisclaimerAckAt) return entry;

      const next = await tx.contentEntry.update({
        where: { id },
        data: { legalDisclaimerAckAt: new Date() },
        select: { id: true, legalKind: true, legalDisclaimerAckAt: true },
      });
      await writeAudit(tx, request, auth, {
        action: 'content.entry.updated',
        entityType: 'content_entry',
        entityId: id,
        after: { legalKind: next.legalKind, legalDisclaimerAckAt: next.legalDisclaimerAckAt },
      });
      return next;
    });

    return ok({
      id: result.id,
      acknowledgedAt: result.legalDisclaimerAckAt?.toISOString() ?? null,
    });
  });

  // ── Placements ────────────────────────────────────────────────────────────
  app.get('/v1/legal/placements', async (request) => {
    const auth = requireRole(request, 'viewer');
    // Show the active site's footer: tenant-wide (null) placements + this site's
    // own (docs/49 Phase 6c). `propertyId` rides along so the UI can show scope.
    const propertyId = await activeProperty(request, auth);
    const rows = await withRequestTenant(request, (tx) =>
      tx.siteDocPlacement.findMany({
        where: { placement: 'footer', OR: [{ propertyId: null }, { propertyId }] },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          label: true,
          legalKind: true,
          columnKey: true,
          position: true,
          enabled: true,
          entryId: true,
          propertyId: true,
          entry: { select: { slug: true, status: true } },
        },
      })
    );
    return ok(
      rows.map((r) => ({
        id: r.id,
        label: r.label,
        legalKind: r.legalKind,
        columnKey: r.columnKey,
        position: r.position,
        enabled: r.enabled,
        entryId: r.entryId,
        // null = shown on every site; otherwise scoped to this one site.
        propertyId: r.propertyId,
        slug: r.entry?.slug ?? null,
        status: r.entry?.status ?? null,
      }))
    );
  });

  app.post('/v1/legal/placements', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    const input = z
      .object({
        entryId: z.string().uuid(),
        label: z.string().max(120).optional(),
        columnKey: z.string().max(40).optional(),
        position: z.number().int().min(0).optional(),
        // Scope to the active site only (docs/49 Phase 6c). Default false =
        // tenant-wide (shown on every site) — the common case for legal docs.
        siteScoped: z.boolean().optional(),
      })
      .parse(request.body);

    // A site-scoped placement targets the active site; tenant-wide stays null.
    const propertyId = input.siteScoped ? await activeProperty(request, auth) : null;

    const created = await withRequestTenant(request, async (tx) => {
      const entry = await tx.contentEntry.findFirst({
        where: { id: input.entryId, deletedAt: null },
        select: { id: true, legalKind: true },
      });
      if (!entry) throw notFound('Page', input.entryId);
      const dup = await tx.siteDocPlacement.findFirst({
        where: { placement: 'footer', sourceKind: 'cms_entry', entryId: entry.id, propertyId },
        select: { id: true },
      });
      if (dup) {
        throw conflict(
          propertyId
            ? 'That page is already placed in this site’s footer.'
            : 'That page is already placed in the footer.'
        );
      }
      const maxPos = await tx.siteDocPlacement.aggregate({
        where: { placement: 'footer' },
        _max: { position: true },
      });
      return tx.siteDocPlacement.create({
        data: {
          tenantId: auth.tenantId,
          propertyId,
          placement: 'footer',
          sourceKind: 'cms_entry',
          entryId: entry.id,
          legalKind: entry.legalKind,
          label: input.label ?? null,
          columnKey: input.columnKey ?? 'legal',
          position: input.position ?? (maxPos._max.position ?? -1) + 1,
        },
      });
    });
    reply.code(201);
    return ok(created);
  });

  app.patch('/v1/legal/placements/:id', async (request) => {
    requireRole(request, 'editor');
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const input = z
      .object({
        enabled: z.boolean().optional(),
        position: z.number().int().min(0).optional(),
        label: z.string().max(120).nullable().optional(),
        columnKey: z.string().max(40).optional(),
      })
      .parse(request.body);

    const updated = await withRequestTenant(request, async (tx) => {
      const existing = await tx.siteDocPlacement.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) throw notFound('Placement', id);
      return tx.siteDocPlacement.update({ where: { id }, data: input });
    });
    return ok(updated);
  });

  app.delete('/v1/legal/placements/:id', async (request) => {
    requireRole(request, 'editor');
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await withRequestTenant(request, async (tx) => {
      const existing = await tx.siteDocPlacement.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) throw notFound('Placement', id);
      await tx.siteDocPlacement.delete({ where: { id } });
    });
    return ok({ deleted: true });
  });

  return Promise.resolve();
};

export default legalRoutes;

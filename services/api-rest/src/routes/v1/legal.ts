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

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, type Prisma } from '@sparx/db';
import { withRequestTenant } from '@sparx/api-core/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { recordRevision, serializeEntry } from '@sparx/api-core/entries';
import { writeAudit } from '@sparx/api-core/audit';
import { publish } from '@sparx/api-core/pubsub';
import { conflict, notFound } from '@sparx/api-core/errors';
import {
  LEGAL_TEMPLATES,
  getLegalTemplate,
  requiredLegalKinds,
  legalEntryBody,
  type LegalKind,
} from '@sparx/legal-templates';

type Json = Prisma.InputJsonValue;

const LEGAL_KINDS = LEGAL_TEMPLATES.map((t) => t.legalKind) as [LegalKind, ...LegalKind[]];

async function commerceEnabled(tenantId: string): Promise<boolean> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const modules = (t?.settings as { modules?: Record<string, { enabled?: boolean }> } | null)
    ?.modules;
  return Boolean(modules?.commerce?.enabled);
}

type ChecklistState = 'complete' | 'missing' | 'draft' | 'stale' | 'unplaced';

const legalRoutes: FastifyPluginAsync = (app) => {
  // ── Checklist ───────────────────────────────────────────────────────────
  app.get('/v1/legal/checklist', async (request) => {
    const auth = requireRole(request, 'viewer');
    const commerce = await commerceEnabled(auth.tenantId);
    const required = new Set(requiredLegalKinds({ commerceEnabled: commerce }));

    const { entries, placedEntryIds } = await withRequestTenant(request, async (tx) => {
      const rows = await tx.contentEntry.findMany({
        where: { typeKey: 'page', legalKind: { not: null }, deletedAt: null },
        select: {
          id: true,
          slug: true,
          status: true,
          legalKind: true,
          legalTemplateVersion: true,
          legalDisclaimerAckAt: true,
          updatedAt: true,
        },
      });
      const placements = await tx.storefrontDocPlacement.findMany({
        where: { placement: 'footer', enabled: true, entryId: { not: null } },
        select: { entryId: true },
      });
      return {
        entries: rows,
        placedEntryIds: new Set(placements.map((p) => p.entryId)),
      };
    });

    const byKind = new Map(entries.map((e) => [e.legalKind, e]));

    const items = LEGAL_TEMPLATES.map((t) => {
      const entry = byKind.get(t.legalKind);
      const placed = entry ? placedEntryIds.has(entry.id) : false;
      let state: ChecklistState;
      if (!entry) state = 'missing';
      else if (entry.status !== 'published') state = 'draft';
      else if ((entry.legalTemplateVersion ?? 0) < t.templateVersion) state = 'stale';
      else if (!placed) state = 'unplaced';
      else state = 'complete';
      return {
        legalKind: t.legalKind,
        title: t.title,
        defaultSlug: t.defaultSlug,
        required: required.has(t.legalKind),
        state,
        entry: entry
          ? {
              id: entry.id,
              slug: entry.slug,
              status: entry.status,
              updatedAt: entry.updatedAt.toISOString(),
              templateVersion: entry.legalTemplateVersion,
              currentVersion: t.templateVersion,
              acknowledged: entry.legalDisclaimerAckAt !== null,
              placed,
            }
          : null,
      };
    });

    const requiredItems = items.filter((i) => i.required);
    const completeRequired = requiredItems.filter((i) => i.state === 'complete').length;

    return ok({
      items,
      completeness: {
        requiredTotal: requiredItems.length,
        requiredComplete: completeRequired,
      },
    });
  });

  // ── Instantiate a starter template → draft page (+ footer placement) ──────
  app.post('/v1/legal/pages', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    const { legalKind } = z.object({ legalKind: z.enum(LEGAL_KINDS) }).parse(request.body);
    const template = getLegalTemplate(legalKind);
    if (!template) throw notFound('Legal template', legalKind);

    const created = await withRequestTenant(request, async (tx) => {
      const existing = await tx.contentEntry.findFirst({
        where: { typeKey: 'page', legalKind, deletedAt: null },
        select: { id: true },
      });
      if (existing) {
        throw conflict(`A ${template.title} page already exists.`);
      }
      // Slug collision with a non-legal page at the same slug → 409.
      const slugClash = await tx.contentEntry.findFirst({
        where: { typeKey: 'page', slug: template.defaultSlug, deletedAt: null },
        select: { id: true },
      });
      if (slugClash) {
        throw conflict(`A page with slug "${template.defaultSlug}" already exists.`);
      }

      const body = legalEntryBody(template);
      const entry = await tx.contentEntry.create({
        data: {
          tenantId: auth.tenantId,
          typeKey: 'page',
          slug: template.defaultSlug,
          status: 'draft',
          body: body as unknown as Json,
          legalKind: template.legalKind,
          legalTemplateVersion: template.templateVersion,
        },
      });

      await recordRevision(tx, {
        tenantId: auth.tenantId,
        entryId: entry.id,
        body,
        seoJson: {},
        status: entry.status,
        kind: 'manual',
        authorId: auth.actorId,
        summary: 'Created from legal starter template',
      });

      // Footer placement (find-or-create — avoids the nullable compound unique).
      const existingPlacement = await tx.storefrontDocPlacement.findFirst({
        where: { placement: 'footer', sourceKind: 'cms_entry', entryId: entry.id },
        select: { id: true },
      });
      if (!existingPlacement) {
        const maxPos = await tx.storefrontDocPlacement.aggregate({
          where: { placement: 'footer' },
          _max: { position: true },
        });
        await tx.storefrontDocPlacement.create({
          data: {
            tenantId: auth.tenantId,
            placement: 'footer',
            sourceKind: 'cms_entry',
            entryId: entry.id,
            legalKind: template.legalKind,
            label: template.title,
            columnKey: 'legal',
            position: (maxPos._max.position ?? -1) + 1,
          },
        });
      }

      await writeAudit(tx, request, auth, {
        action: 'content.entry.created',
        entityType: 'content_entry',
        entityId: entry.id,
        after: { typeKey: entry.typeKey, slug: entry.slug, legalKind: entry.legalKind },
      });
      return entry;
    });

    await publish(request.log, 'content.entry.created', auth.tenantId, auth.actorId, {
      entryId: created.id,
      typeKey: created.typeKey,
      slug: created.slug,
      status: created.status,
    });

    reply.code(201);
    return ok(serializeEntry(created));
  });

  // ── Placements ────────────────────────────────────────────────────────────
  app.get('/v1/legal/placements', async (request) => {
    requireRole(request, 'viewer');
    const rows = await withRequestTenant(request, (tx) =>
      tx.storefrontDocPlacement.findMany({
        where: { placement: 'footer' },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          label: true,
          legalKind: true,
          columnKey: true,
          position: true,
          enabled: true,
          entryId: true,
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
      })
      .parse(request.body);

    const created = await withRequestTenant(request, async (tx) => {
      const entry = await tx.contentEntry.findFirst({
        where: { id: input.entryId, deletedAt: null },
        select: { id: true, legalKind: true },
      });
      if (!entry) throw notFound('Page', input.entryId);
      const dup = await tx.storefrontDocPlacement.findFirst({
        where: { placement: 'footer', sourceKind: 'cms_entry', entryId: entry.id },
        select: { id: true },
      });
      if (dup) throw conflict('That page is already placed in the footer.');
      const maxPos = await tx.storefrontDocPlacement.aggregate({
        where: { placement: 'footer' },
        _max: { position: true },
      });
      return tx.storefrontDocPlacement.create({
        data: {
          tenantId: auth.tenantId,
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
      const existing = await tx.storefrontDocPlacement.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) throw notFound('Placement', id);
      return tx.storefrontDocPlacement.update({ where: { id }, data: input });
    });
    return ok(updated);
  });

  app.delete('/v1/legal/placements/:id', async (request) => {
    requireRole(request, 'editor');
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await withRequestTenant(request, async (tx) => {
      const existing = await tx.storefrontDocPlacement.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) throw notFound('Placement', id);
      await tx.storefrontDocPlacement.delete({ where: { id } });
    });
    return ok({ deleted: true });
  });

  return Promise.resolve();
};

export default legalRoutes;

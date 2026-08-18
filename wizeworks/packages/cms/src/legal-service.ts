// Legal-page service (docs/42 §3) — the shared logic behind the legal CHECKLIST and
// instantiating a starter template into a draft page. The REST route and the MCP tools
// both drive legal-page discovery + scaffolding through here, so the checklist state
// machine and the template→draft(+footer placement) instantiation live in ONE place —
// the same "one service, many transports" rule as entries-service.
//
// What deliberately stays OUT of this surface: PUBLISHING and the starter-text
// DISCLAIMER ACKNOWLEDGMENT. Those are a human approval gate — a caller may scaffold a
// draft, but a person reviews the starter text, acknowledges it (legal_disclaimer_ack_at),
// and takes it live. The REST route keeps those two handlers; nothing here approves legal.

import type { ContentEntry, Prisma, TxClient } from '@wizeworks/db';
import { withTenant } from '@wizeworks/db';
import { conflict } from '@wizeworks/api-core/errors';
import {
  LEGAL_TEMPLATES,
  getLegalTemplate,
  requiredLegalKinds,
  legalEntryBody,
  type LegalKind,
} from '@wizeworks/legal-templates';

import { recordRevision } from './entries.js';
import type { CmsWriteContext, CmsEmittedEvent } from './service-support.js';

type Json = Prisma.InputJsonValue;

/** Where a legal template stands for this tenant: `missing` (no page), `draft` (exists
 *  but unpublished), `stale` (published on an older template version), `unplaced`
 *  (published but not in the footer), or `complete`. */
export type LegalChecklistState = 'complete' | 'missing' | 'draft' | 'stale' | 'unplaced';

export interface LegalChecklistItem {
  legalKind: LegalKind;
  title: string;
  defaultSlug: string;
  /** Privacy is always required; commerce docs (returns/shipping/refund) only when the
   *  Commerce module is on; the rest optional. */
  required: boolean;
  state: LegalChecklistState;
  entry: {
    id: string;
    slug: string | null;
    status: string;
    updatedAt: string;
    templateVersion: number | null;
    currentVersion: number;
    /** The tenant accepted the starter-text disclaimer (a human approval, not an agent). */
    acknowledged: boolean;
    /** Wired into the footer via a placement — the reason a footer legal link resolves. */
    placed: boolean;
  } | null;
}

export interface LegalChecklist {
  items: LegalChecklistItem[];
  completeness: { requiredTotal: number; requiredComplete: number };
}

async function commerceEnabledTx(tx: TxClient, tenantId: string): Promise<boolean> {
  const t = await tx.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const modules = (t?.settings as { modules?: Record<string, { enabled?: boolean }> } | null)
    ?.modules;
  return Boolean(modules?.commerce?.enabled);
}

/** The legal checklist over the platform template registry: for each template, whether
 *  the tenant has a page, whether it's published, current, and placed in the footer. */
export async function getLegalChecklistTx(tx: TxClient, tenantId: string): Promise<LegalChecklist> {
  const required = new Set(
    requiredLegalKinds({ commerceEnabled: await commerceEnabledTx(tx, tenantId) })
  );

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
  const placements = await tx.siteDocPlacement.findMany({
    where: { placement: 'footer', enabled: true, entryId: { not: null } },
    select: { entryId: true },
  });
  const placedEntryIds = new Set(placements.map((p) => p.entryId));
  const byKind = new Map(rows.map((e) => [e.legalKind, e]));

  const items: LegalChecklistItem[] = LEGAL_TEMPLATES.map((t) => {
    const entry = byKind.get(t.legalKind);
    const placed = entry ? placedEntryIds.has(entry.id) : false;
    let state: LegalChecklistState;
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
  return {
    items,
    completeness: {
      requiredTotal: requiredItems.length,
      requiredComplete: requiredItems.filter((i) => i.state === 'complete').length,
    },
  };
}

/** Tx-opening wrapper for callers with no ambient transaction (the MCP tools). */
export function getLegalChecklist(tenantId: string): Promise<LegalChecklist> {
  return withTenant({ tenantId }, (tx) => getLegalChecklistTx(tx, tenantId));
}

export interface LegalPageResult {
  entry: ContentEntry;
  events: CmsEmittedEvent[];
}

/** Instantiate a legal starter template into a DRAFT page plus a tenant-wide footer
 *  placement (propertyId null = every site). Refuses if a page of that kind — or any
 *  page already sitting at the template's default slug — exists. Draft + unacknowledged
 *  by design: the caller/human publishes and accepts the disclaimer. Returns the entry
 *  and the domain events for the caller to emit (transport owns the event bus). */
export async function createLegalPageTx(
  tx: TxClient,
  ctx: CmsWriteContext,
  legalKind: LegalKind
): Promise<LegalPageResult> {
  const template = getLegalTemplate(legalKind);
  if (!template) throw conflict(`Unknown legal template "${legalKind}".`);

  const existing = await tx.contentEntry.findFirst({
    where: { typeKey: 'page', legalKind, deletedAt: null },
    select: { id: true },
  });
  if (existing) throw conflict(`A ${template.title} page already exists.`);

  const slugClash = await tx.contentEntry.findFirst({
    where: { typeKey: 'page', slug: template.defaultSlug, deletedAt: null },
    select: { id: true },
  });
  if (slugClash) throw conflict(`A page with slug "${template.defaultSlug}" already exists.`);

  const body = legalEntryBody(template);
  const entry = await tx.contentEntry.create({
    data: {
      tenantId: ctx.tenantId,
      typeKey: 'page',
      slug: template.defaultSlug,
      status: 'draft',
      body: body as unknown as Json,
      legalKind: template.legalKind,
      legalTemplateVersion: template.templateVersion,
    },
  });

  await recordRevision(tx, {
    tenantId: ctx.tenantId,
    entryId: entry.id,
    body,
    seoJson: {},
    status: entry.status,
    kind: 'manual',
    authorId: ctx.actorId,
    summary: 'Created from legal starter template',
  });

  // Find-or-create the tenant-wide footer placement, scoped to propertyId null so a
  // site-specific placement of the same page never blocks the default one.
  const existingPlacement = await tx.siteDocPlacement.findFirst({
    where: { placement: 'footer', sourceKind: 'cms_entry', entryId: entry.id, propertyId: null },
    select: { id: true },
  });
  if (!existingPlacement) {
    const maxPos = await tx.siteDocPlacement.aggregate({
      where: { placement: 'footer' },
      _max: { position: true },
    });
    await tx.siteDocPlacement.create({
      data: {
        tenantId: ctx.tenantId,
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

  return {
    entry,
    events: [
      {
        type: 'content.entry.created',
        data: { entryId: entry.id, typeKey: entry.typeKey, slug: entry.slug, status: entry.status },
      },
    ],
  };
}

/** Tx-opening wrapper for callers with no ambient transaction (the MCP tools). */
export function createLegalPage(
  ctx: CmsWriteContext,
  legalKind: LegalKind
): Promise<LegalPageResult> {
  return withTenant({ tenantId: ctx.tenantId }, (tx) => createLegalPageTx(tx, ctx, legalKind));
}

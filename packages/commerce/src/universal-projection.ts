// Universal-search projectors (docs/39 §5) for the Phase-1 entity set.
//
// These live in @sparx/commerce — the same home as projectCustomer/projectOrder
// — because the commerce-indexer already depends on @sparx/commerce, so no new
// dependency edge / Dockerfile COPY is needed. All five read straight through
// @sparx/db's Prisma client (one schema spans Commerce + CRM models), so the
// CRM entities (b2b_account, quote) project here without pulling @sparx/crm's
// service layer.
//
// Each entity also publishes `search.entity.changed` from its write sites (via
// @sparx/events `indexEntity`) so the index stays live; reindex walks
// `commerceUniversalProjectors` to backfill. The doc shape is dictated by
// packages/search/src/schemas/entities.ts — keep them in sync.

import { withTenant } from '@sparx/db';
import {
  type EntityProjector,
  type ProjectorContext,
  type UniversalSearchDocument,
  universalId,
} from '@sparx/search';

// ─── helpers ─────────────────────────────────────────────────────────

function epoch(d: Date | null | undefined): number {
  return d ? Math.floor(d.getTime() / 1000) : 0;
}

/** Drop nullish/empty entries; return undefined when nothing's left so the
 *  optional Typesense field is omitted rather than stored as `[]`. */
function keywords(values: (string | null | undefined)[]): string[] | undefined {
  const out = values
    .map((v) => v?.trim())
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  return out.length > 0 ? Array.from(new Set(out)) : undefined;
}

/** Cap long free-text (CMS body, notes, descriptions) so the index stays lean. */
function snippet(s: string | null | undefined, max = 2000): string | undefined {
  if (!s) return undefined;
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function customerName(c: {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}): string | undefined {
  const full = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return full || c.company || c.email || undefined;
}

// ─── commerce: warehouse ─────────────────────────────────────────────

const warehouseProjector: EntityProjector = {
  entityType: 'warehouse',
  module: 'commerce',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.warehouse.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const w = await tx.warehouse.findFirst({ where: { id, deletedAt: null } });
      if (!w) return null;
      return {
        id: universalId(ctx.tenantId, 'warehouse', w.id),
        tenant_id: ctx.tenantId,
        entity_type: 'warehouse',
        module: 'commerce',
        record_id: w.id,
        title: w.name,
        subtitle: w.code,
        keywords: keywords([w.code, w.city, w.region, w.country, w.phone, w.type]),
        status: w.isActive ? 'active' : 'inactive',
        url: `/commerce/warehouses/${w.id}`,
        created_at: epoch(w.createdAt),
        updated_at: epoch(w.updatedAt),
      };
    }),
};

// ─── commerce: discount ──────────────────────────────────────────────

const discountProjector: EntityProjector = {
  entityType: 'discount',
  module: 'commerce',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.discount.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const d = await tx.discount.findFirst({ where: { id, deletedAt: null } });
      if (!d) return null;
      return {
        id: universalId(ctx.tenantId, 'discount', d.id),
        tenant_id: ctx.tenantId,
        entity_type: 'discount',
        module: 'commerce',
        record_id: d.id,
        title: d.name,
        subtitle: d.code ?? d.type,
        body: snippet(d.description),
        keywords: keywords([d.code, d.type, d.scope]),
        status: d.status,
        url: `/commerce/discounts/${d.id}`,
        created_at: epoch(d.createdAt),
        updated_at: epoch(d.updatedAt),
      };
    }),
};

// ─── commerce: gift_card (no soft-delete column) ─────────────────────

const giftCardProjector: EntityProjector = {
  entityType: 'gift_card',
  module: 'commerce',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.giftCard.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const g = await tx.giftCard.findFirst({ where: { id } });
      if (!g) return null;
      return {
        id: universalId(ctx.tenantId, 'gift_card', g.id),
        tenant_id: ctx.tenantId,
        entity_type: 'gift_card',
        module: 'commerce',
        record_id: g.id,
        title: g.code,
        subtitle: g.recipientName ?? g.recipientEmail ?? undefined,
        keywords: keywords([g.code, g.recipientEmail, g.recipientName]),
        status: g.status,
        url: `/commerce/gift-cards/${g.id}`,
        created_at: epoch(g.createdAt),
        updated_at: epoch(g.updatedAt),
      };
    }),
};

// ─── crm: b2b_account ────────────────────────────────────────────────

const b2bAccountProjector: EntityProjector = {
  entityType: 'b2b_account',
  module: 'crm',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.b2BAccount.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const a = await tx.b2BAccount.findFirst({ where: { id, deletedAt: null } });
      if (!a) return null;
      return {
        id: universalId(ctx.tenantId, 'b2b_account', a.id),
        tenant_id: ctx.tenantId,
        entity_type: 'b2b_account',
        module: 'crm',
        record_id: a.id,
        title: a.companyName,
        subtitle: a.pricingTier ?? a.status,
        body: snippet(a.notes),
        keywords: keywords([a.companyName, a.taxId, a.website, ...a.tags]),
        status: a.status,
        url: `/crm/b2b/${a.id}`,
        created_at: epoch(a.createdAt),
        updated_at: epoch(a.updatedAt),
      };
    }),
};

// ─── crm: quote (no soft-delete column) ──────────────────────────────

const quoteProjector: EntityProjector = {
  entityType: 'quote',
  module: 'crm',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.quote.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const q = await tx.quote.findFirst({
        where: { id },
        include: {
          customer: { select: { firstName: true, lastName: true, company: true, email: true } },
          b2bAccount: { select: { companyName: true } },
        },
      });
      if (!q) return null;
      const who = q.b2bAccount?.companyName ?? (q.customer ? customerName(q.customer) : undefined);
      return {
        id: universalId(ctx.tenantId, 'quote', q.id),
        tenant_id: ctx.tenantId,
        entity_type: 'quote',
        module: 'crm',
        record_id: q.id,
        title: q.quoteNumber,
        subtitle: who ?? q.status,
        keywords: keywords([q.quoteNumber, who]),
        status: q.status,
        url: `/crm/quotes/${q.id}`,
        created_at: epoch(q.createdAt),
        updated_at: epoch(q.updatedAt),
      };
    }),
};

/** Phase-1 universal projectors contributed by Commerce + CRM. The
 *  commerce-indexer registers these into its projector registry. */
export const commerceUniversalProjectors: EntityProjector[] = [
  warehouseProjector,
  discountProjector,
  giftCardProjector,
  b2bAccountProjector,
  quoteProjector,
];

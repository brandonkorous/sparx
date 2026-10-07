// Universal-search projectors (docs/39 §5) for the commerce + CRM entity set.
//
// These live in @wizeworks/commerce — the same home as projectCustomer/projectOrder
// — because the commerce-indexer already depends on @wizeworks/commerce, so no new
// dependency edge / Dockerfile COPY is needed. They all read straight through
// @wizeworks/db's Prisma client (one schema spans Commerce + CRM models), so the
// CRM entities (b2b_account, quote, segment, pipeline, deal, task) project here
// without pulling @wizeworks/crm's service layer.
//
// Phase 1 (shipped): warehouse, discount, gift_card, b2b_account, quote.
// Phase 2 (breadth): collection, category, bundle, subscription, review, return,
// segment, pipeline, deal, task.
//
// Each entity becomes live by publishing `search.entity.changed` from its write
// sites (via @wizeworks/events `indexEntity`); reindex walks
// `commerceUniversalProjectors` to backfill regardless. The doc shape is
// dictated by wizeworks/packages/search/src/schemas/entities.ts — keep them in sync.

import {
  B2B_QUOTE_WORKFLOW_SLUG,
  NET_TERMS_AR_WORKFLOW_SLUG,
} from '@wizeworks/crm-schemas/builtins';
import { companyService } from '@wizeworks/crm';
import { withTenant } from '@wizeworks/db';
import {
  type EntityProjector,
  type ProjectorContext,
  type UniversalSearchDocument,
  universalId,
} from '@wizeworks/search';
import {
  bundlePricingWords,
  collectionKindWords,
  companyStatusWords,
  entryStatusWords,
  fileKindWords,
  paymentStatusWords,
  pipelineObjectWords,
  returnOutcomeWords,
  segmentKindWords,
  taskLineWords,
} from './search-words';

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
  companyName: string | null;
  email: string | null;
}): string | undefined {
  // An explicit empty-string check (not `??`) so a blank full name falls
  // through to company / email rather than winning as ''.
  const full = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  if (full) return full;
  return c.companyName ?? c.email ?? undefined;
}

/** Read a trimmed non-empty string out of an untyped JSON value, else undefined. */
function pickString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

/** 'blog_post' → 'Blog Post' — a readable label for a content type key. */
function humanizeTypeKey(k: string): string {
  return k.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── commerce: warehouse ─────────────────────────────────────────────

const warehouseProjector: EntityProjector = {
  entityType: 'warehouse',
  // `inventory`, matching the document below. Warehouses moved to the Inventory
  // module (docs/100 P1e) and this declaration was left behind saying 'commerce'
  // — harmless, because nothing reads it, and that is exactly what makes it
  // dangerous: it is the line somebody edits believing they have changed the
  // module, while the document three lines down goes on saying something else.
  // One `site` projector was "fixed" that way and stayed broken.
  module: 'inventory',
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
        // Warehouses belong to the Inventory module now (docs/100 P1e); the deep
        // link + facet follow the move even though the projector still lives here.
        module: 'inventory',
        record_id: w.id,
        title: w.name,
        subtitle: w.code,
        keywords: keywords([w.code, w.city, w.region, w.country, w.phone, w.type]),
        status: w.isActive ? 'active' : 'inactive',
        url: `/inventory/warehouses/${w.id}`,
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

// ─── commerce: collection ────────────────────────────────────────────

const collectionProjector: EntityProjector = {
  entityType: 'collection',
  module: 'commerce',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.productCollection.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const c = await tx.productCollection.findFirst({ where: { id, deletedAt: null } });
      if (!c) return null;
      return {
        id: universalId(ctx.tenantId, 'collection', c.id),
        tenant_id: ctx.tenantId,
        entity_type: 'collection',
        module: 'commerce',
        record_id: c.id,
        title: c.name,
        subtitle: collectionKindWords(c.type),
        body: snippet(c.description),
        keywords: keywords([c.handle, c.type]),
        // No publish flag on collections — a non-deleted collection is live;
        // mark 'active' so the public storefront status filter admits it.
        status: 'active',
        url: `/commerce/collections/${c.id}`,
        created_at: epoch(c.createdAt),
        updated_at: epoch(c.updatedAt),
      };
    }),
};

// ─── commerce: category ──────────────────────────────────────────────
// No standalone /commerce/categories/[id] route yet — link to the category
// list (never a dead link); tighten to the record when a detail route lands.

const categoryProjector: EntityProjector = {
  entityType: 'category',
  module: 'commerce',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.productCategory.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const c = await tx.productCategory.findFirst({ where: { id, deletedAt: null } });
      if (!c) return null;
      return {
        id: universalId(ctx.tenantId, 'category', c.id),
        tenant_id: ctx.tenantId,
        entity_type: 'category',
        module: 'commerce',
        record_id: c.id,
        title: c.name,
        // No second line. The handle repeated the name in the database's
        // spelling (issue 914), and it stays a keyword so it still finds it.
        body: snippet(c.description),
        keywords: keywords([c.handle]),
        url: '/commerce/categories',
        created_at: epoch(c.createdAt),
        updated_at: epoch(c.updatedAt),
      };
    }),
};

// ─── commerce: bundle (titled by its wrapper product; no soft-delete) ─

const bundleProjector: EntityProjector = {
  entityType: 'bundle',
  module: 'commerce',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.bundle.findMany({
        where: { bundleProduct: { deletedAt: null } },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const b = await tx.bundle.findFirst({
        where: { id },
        include: {
          bundleProduct: { select: { title: true, handle: true, status: true, deletedAt: true } },
        },
      });
      if (!b || b.bundleProduct.deletedAt) return null;
      return {
        id: universalId(ctx.tenantId, 'bundle', b.id),
        tenant_id: ctx.tenantId,
        entity_type: 'bundle',
        module: 'commerce',
        record_id: b.id,
        title: b.bundleProduct.title,
        subtitle: bundlePricingWords(b.pricingMode),
        keywords: keywords([b.bundleProduct.handle, b.pricingMode]),
        status: b.bundleProduct.status,
        url: `/commerce/bundles/${b.id}`,
        created_at: epoch(b.createdAt),
        updated_at: epoch(b.updatedAt),
      };
    }),
};

// ─── commerce: subscription (no name — titled by its customer) ────────

const subscriptionProjector: EntityProjector = {
  entityType: 'subscription',
  module: 'commerce',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.subscription.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const s = await tx.subscription.findFirst({
        where: { id },
        include: {
          customer: { select: { firstName: true, lastName: true, companyName: true, email: true } },
        },
      });
      if (!s) return null;
      const who = customerName(s.customer);
      return {
        id: universalId(ctx.tenantId, 'subscription', s.id),
        tenant_id: ctx.tenantId,
        entity_type: 'subscription',
        module: 'commerce',
        record_id: s.id,
        title: who ?? 'Subscription',
        subtitle: `every ${s.intervalCount} ${s.intervalUnit}`,
        keywords: keywords([who, s.customer.email, s.providerSlug]),
        status: s.status,
        url: `/commerce/subscriptions/${s.id}`,
        created_at: epoch(s.createdAt),
        updated_at: epoch(s.updatedAt),
      };
    }),
};

// ─── commerce: review ─────────────────────────────────────────────────

const reviewProjector: EntityProjector = {
  entityType: 'review',
  module: 'commerce',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.productReview.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const r = await tx.productReview.findFirst({
        where: { id, deletedAt: null },
        include: { product: { select: { title: true } } },
      });
      if (!r) return null;
      // title is a non-null column but may be blank — fall through to a body
      // snippet (`||`, not `??`, so an empty string falls through).
      const title = r.title || (snippet(r.body, 80) ?? 'Review');
      return {
        id: universalId(ctx.tenantId, 'review', r.id),
        tenant_id: ctx.tenantId,
        entity_type: 'review',
        module: 'commerce',
        record_id: r.id,
        title,
        subtitle: r.product.title,
        body: snippet(r.body),
        keywords: keywords([r.displayName, r.product.title]),
        status: r.status,
        url: `/commerce/reviews/${r.id}`,
        created_at: epoch(r.createdAt),
        updated_at: epoch(r.updatedAt),
      };
    }),
};

// ─── commerce: return / RMA ───────────────────────────────────────────

const returnProjector: EntityProjector = {
  entityType: 'return',
  module: 'commerce',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.returnRequest.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const r = await tx.returnRequest.findFirst({ where: { id } });
      if (!r) return null;
      // ReturnRequest has no `order` relation — fetch the order number for a
      // human-searchable title (RMAs are found by their order).
      const order = await tx.order.findUnique({
        where: { id: r.orderId },
        select: { orderNumber: true },
      });
      const orderNo = order?.orderNumber;
      return {
        id: universalId(ctx.tenantId, 'return', r.id),
        tenant_id: ctx.tenantId,
        entity_type: 'return',
        module: 'commerce',
        record_id: r.id,
        title: orderNo ? `Return · ${orderNo}` : `Return ${r.id.slice(0, 8)}`,
        subtitle: returnOutcomeWords(r.preferredOutcome),
        keywords: keywords([orderNo, r.status, r.preferredOutcome, r.requestedBy]),
        status: r.status,
        url: `/commerce/returns/${r.id}`,
        created_at: epoch(r.createdAt),
        updated_at: epoch(r.updatedAt),
      };
    }),
};

// ─── crm: b2b_account ────────────────────────────────────────────────

const b2bAccountProjector: EntityProjector = {
  entityType: 'b2b_account',
  module: 'crm',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.company.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      // The tier's name comes from the tier the account points at. The legacy
      // free-text column was empty on every account set up from the tiers
      // screen, so the search box showed Gillett's accounts with no tier at all
      // (sparx persona issue 086).
      const a = await tx.company.findFirst({
        where: { id, deletedAt: null },
        include: { pricingTierFk: { select: { name: true, deletedAt: true } } },
      });
      if (!a) return null;
      // A removed tier prices nothing, so it is not named under the account.
      const tier = companyService.tierInEffect(a.pricingTierFk);
      return {
        id: universalId(ctx.tenantId, 'b2b_account', a.id),
        tenant_id: ctx.tenantId,
        entity_type: 'b2b_account',
        module: 'crm',
        record_id: a.id,
        title: a.companyName,
        subtitle: tier ? tier.name : companyStatusWords(a.status),
        body: snippet(a.notes),
        keywords: keywords([a.companyName, a.taxId, a.website, tier?.name, ...a.tags]),
        status: a.status,
        url: `/crm/b2b/${a.id}`,
        created_at: epoch(a.createdAt),
        updated_at: epoch(a.updatedAt),
      };
    }),
};

// ─── invoicing: billing document (quote/estimate/invoice/receipt) ─────
// (soft-deletable — excludes deletedAt rows, unlike the other CRM projectors
// above which have no soft-delete column)

// A wholesale quote is indexed as a `quote`, not a `billing_document`. Both are
// rows in the same table, but they are different things on screen with
// different homes: the search box filed Wasatch Front's quotes Q-000012 and
// Q-000013 under "Invoices", and opening one landed on the wholesale invoices
// list rather than on the quote (sparx persona issue 086). The route table
// already sends `quote` to the quote's own screen under "Quotes", and the CRM
// bridge already publishes `crm.quote.*` as `quote`; what was missing was this
// projector, so every one of those events was skipped as "no projector".
//
// One reader serves both, and each answers only for its own kind. A billing
// event about a quote therefore projects to null on the `billing_document`
// side, which DELETES the old `billing_document` entry the quote used to have,
// and the reindex walk finds the quote under `quote`. Each projector writes its
// own `entity_type` and `module` out literally, so check:search-entities can
// read and check both.

/** Is this workflow's document a wholesale quote? The one rule for the split. */
function isWholesaleQuote(workflowSlug: string): boolean {
  return workflowSlug === B2B_QUOTE_WORKFLOW_SLUG;
}

/** The screen a document opens on: the quote, the invoice on account, or the
 *  invoice editor. The old `/invoicing/documents/:id` matched no screen. */
function billingDocumentUrl(workflowSlug: string, id: string): string {
  if (isWholesaleQuote(workflowSlug)) return `/wholesale/quotes/${id}`;
  if (workflowSlug === NET_TERMS_AR_WORKFLOW_SLUG) return `/wholesale/invoices/${id}`;
  return `/invoicing/invoices/${id}`;
}

function listBillingDocumentIds(ctx: ProjectorContext, quotes: boolean): Promise<string[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.billingDocument.findMany({
      where: {
        deletedAt: null,
        workflow: quotes
          ? { slug: B2B_QUOTE_WORKFLOW_SLUG }
          : { slug: { not: B2B_QUOTE_WORKFLOW_SLUG } },
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  });
}

/** Everything a billing document's search entry says except which kind it is,
 *  or null when the row is gone or is the other kind. */
function readBillingDocument(
  ctx: ProjectorContext,
  id: string,
  quote: boolean
): Promise<Omit<UniversalSearchDocument, 'id' | 'tenant_id' | 'entity_type' | 'module'> | null> {
  return withTenant(ctx, async (tx) => {
    const doc = await tx.billingDocument.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: { select: { firstName: true, lastName: true, companyName: true, email: true } },
        company: { select: { companyName: true } },
        workflow: { select: { slug: true } },
      },
    });
    if (!doc || isWholesaleQuote(doc.workflow.slug) !== quote) return null;
    const who = doc.company?.companyName ?? (doc.customer ? customerName(doc.customer) : undefined);
    return {
      record_id: doc.id,
      title: doc.number ?? 'Untitled document',
      subtitle: who ?? paymentStatusWords(doc.status),
      keywords: keywords([doc.number, who]),
      status: doc.status,
      url: billingDocumentUrl(doc.workflow.slug, doc.id),
      created_at: epoch(doc.createdAt),
      updated_at: epoch(doc.updatedAt),
    };
  });
}

const billingDocumentProjector: EntityProjector = {
  entityType: 'billing_document',
  module: 'invoicing',
  listIdsForTenant: (ctx: ProjectorContext) => listBillingDocumentIds(ctx, false),
  project: async (ctx: ProjectorContext, id: string) => {
    const doc = await readBillingDocument(ctx, id, false);
    if (!doc) return null;
    return {
      id: universalId(ctx.tenantId, 'billing_document', id),
      tenant_id: ctx.tenantId,
      entity_type: 'billing_document',
      module: 'invoicing',
      ...doc,
    };
  },
};

const quoteProjector: EntityProjector = {
  entityType: 'quote',
  module: 'b2b',
  listIdsForTenant: (ctx: ProjectorContext) => listBillingDocumentIds(ctx, true),
  project: async (ctx: ProjectorContext, id: string) => {
    const doc = await readBillingDocument(ctx, id, true);
    if (!doc) return null;
    return {
      id: universalId(ctx.tenantId, 'quote', id),
      tenant_id: ctx.tenantId,
      entity_type: 'quote',
      module: 'b2b',
      ...doc,
    };
  },
};

// ─── crm: segment (archive = soft-inactive; kept in index with status) ─

const segmentProjector: EntityProjector = {
  entityType: 'segment',
  module: 'crm',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.segment.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const s = await tx.segment.findFirst({ where: { id } });
      if (!s) return null;
      return {
        id: universalId(ctx.tenantId, 'segment', s.id),
        tenant_id: ctx.tenantId,
        entity_type: 'segment',
        module: 'crm',
        record_id: s.id,
        title: s.name,
        // What it is for, the way an automation's row reads, and its kind only
        // when nobody wrote that. It was the slug: "email-engaged" under "Email
        // engaged" said nothing new, in the database's words (issue 914). The
        // slug stays a keyword, so it still finds the segment.
        subtitle: snippet(s.description, 120) ?? segmentKindWords(s.kind),
        body: snippet(s.description),
        keywords: keywords([s.slug]),
        status: s.archivedAt ? 'archived' : 'active',
        url: `/crm/segments/${s.id}`,
        created_at: epoch(s.createdAt),
        updated_at: epoch(s.updatedAt),
      };
    }),
};

// ─── crm: pipeline ────────────────────────────────────────────────────

const pipelineProjector: EntityProjector = {
  entityType: 'pipeline',
  module: 'crm',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.pipeline.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const p = await tx.pipeline.findFirst({ where: { id } });
      if (!p) return null;
      return {
        id: universalId(ctx.tenantId, 'pipeline', p.id),
        tenant_id: ctx.tenantId,
        entity_type: 'pipeline',
        module: 'crm',
        record_id: p.id,
        title: p.name,
        subtitle: pipelineObjectWords(p.objectKey),
        keywords: keywords([p.slug]),
        status: p.archivedAt ? 'archived' : 'active',
        url: `/crm/pipelines/${p.id}`,
        created_at: epoch(p.createdAt),
        updated_at: epoch(p.updatedAt),
      };
    }),
};

// ─── crm: deal ────────────────────────────────────────────────────────

const dealProjector: EntityProjector = {
  entityType: 'deal',
  module: 'crm',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.deal.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const d = await tx.deal.findFirst({
        where: { id, deletedAt: null },
        include: {
          customer: { select: { firstName: true, lastName: true, companyName: true, email: true } },
          company: { select: { companyName: true } },
          stage: { select: { name: true, stageType: true } },
        },
      });
      if (!d) return null;
      const who = d.company?.companyName ?? (d.customer ? customerName(d.customer) : undefined);
      return {
        id: universalId(ctx.tenantId, 'deal', d.id),
        tenant_id: ctx.tenantId,
        entity_type: 'deal',
        module: 'crm',
        record_id: d.id,
        title: d.title,
        subtitle: who ?? d.stage.name,
        keywords: keywords([who, d.source, ...d.tags]),
        status: d.stage.stageType, // open | won | lost
        url: `/crm/deals/${d.id}`,
        created_at: epoch(d.createdAt),
        updated_at: epoch(d.updatedAt),
      };
    }),
};

// ─── crm: task ────────────────────────────────────────────────────────
// No standalone /crm/tasks/[id] route yet — link to the task list (never a
// dead link); tighten to the record when a detail route lands.

const taskProjector: EntityProjector = {
  entityType: 'task',
  module: 'crm',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.task.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const t = await tx.task.findFirst({ where: { id } });
      if (!t) return null;
      return {
        id: universalId(ctx.tenantId, 'task', t.id),
        tenant_id: ctx.tenantId,
        entity_type: 'task',
        module: 'crm',
        record_id: t.id,
        title: t.title,
        subtitle: taskLineWords(t.status, t.priority),
        body: snippet(t.description),
        keywords: keywords([t.priority]),
        status: t.status,
        url: '/crm/tasks',
        created_at: epoch(t.createdAt),
        updated_at: epoch(t.updatedAt),
      };
    }),
};

// ─── commerce: product (also a rich collection; here for global search) ─
// Products keep their faceted `products` collection (storefront PLP, fitment).
// A lightweight universal doc additionally lands here (docs/39 §4.1) so global
// ⌘K + the public storefront "search everything" are one query. Real-time via
// the product.* tee in events.ts; SKU search stays the rich collection's job.

const productProjector: EntityProjector = {
  entityType: 'product',
  module: 'commerce',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.product.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const p = await tx.product.findFirst({ where: { id, deletedAt: null } });
      if (!p) return null;
      return {
        id: universalId(ctx.tenantId, 'product', p.id),
        tenant_id: ctx.tenantId,
        entity_type: 'product',
        module: 'commerce',
        record_id: p.id,
        title: p.title,
        subtitle: p.vendor ?? undefined,
        keywords: keywords([p.handle, p.vendor, ...p.tags]),
        status: p.status, // draft | active | archived (public search filters active)
        url: `/commerce/products/${p.id}`,
        created_at: epoch(p.createdAt),
        updated_at: epoch(p.updatedAt),
      };
    }),
};

// ─── cms: page ─────────────────────────────────────────────────────────────
// Signalled live from the content routes since 2026-09-18 (create, update,
// delete, publish, unpublish, restore), through api-rest's `indexContentEntry`,
// which signals THIS name and `cms_entry` together: one table feeds both
// projectors and a route holds an id, not a typeKey. It was reindex-only until
// then, and `check:search-entities` read it as signalled on the strength of an
// SEO audit snapshot that happens to use the same word.
// Read via the shared Prisma client (no @wizeworks/cms dep / Dockerfile edge, same
// as the CRM projectors). Public storefront search filters status:='published'.
//
// A "page" here is a `ContentEntry` with `typeKey = 'page'` — a tenant's policy and
// standalone pages. It used to read the `Page` MODEL, which is deprecated and holds
// ZERO rows platform-wide, so this projector produced no document for anybody and
// public search's `cms_page` branch could never match (issue 378). The SEO audit had
// always resolved `cms_page` against `contentEntry`; this now agrees with it.
//
// Its sibling `contentEntryProjector` covers every OTHER typeKey, and the split is
// what keeps the two from indexing the same row twice.

const cmsPageProjector: EntityProjector = {
  entityType: 'cms_page',
  module: 'cms',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.contentEntry.findMany({
        where: { typeKey: 'page', deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const p = await tx.contentEntry.findFirst({
        where: { id, typeKey: 'page', deletedAt: null },
      });
      if (!p) return null;
      const body = (p.body ?? {}) as Record<string, unknown>;
      const seo = (p.seoJson ?? {}) as Record<string, unknown>;
      // No title COLUMN on a content entry — it lives in the body the type defines.
      const title = pickString(body.title) ?? p.slug ?? 'Untitled page';
      return {
        id: universalId(ctx.tenantId, 'cms_page', p.id),
        tenant_id: ctx.tenantId,
        entity_type: 'cms_page',
        module: 'cms',
        record_id: p.id,
        title,
        // Nullable on a content entry, unlike the `Page` column this used to read.
        subtitle: p.slug ?? undefined,
        body: snippet(pickString(seo.description) ?? pickString(body.excerpt)),
        keywords: keywords([p.slug]),
        status: p.status, // draft | published (public search filters published)
        url: `/content/${p.id}`,
        created_at: epoch(p.createdAt),
        updated_at: epoch(p.updatedAt),
      };
    }),
};

// ─── builder: site (docs/39 Ph2 / docs/66 — multi-property) ──────────
// A tenant's web properties. Real-time via the site.* indexEntity calls in
// the /v1/properties routes; reindex backfills regardless. Deep-links to the
// sites management surface.
//
// `builder`, not `sitebuilder`. The universal search route filters documents to
// the tenant's ENABLED modules, and `sitebuilder` is not in `ALL_MODULES` — the
// slug for the site builder is `builder`. So every one of these documents was
// dropped by the filter: a tenant with seven websites typed one of their names
// and was told "Nothing in your records matches". Measured 2026-09-18: 7 site
// documents indexed, 7 unreachable. [[feedback_absent_behaves_like_fine]]
const siteProjector: EntityProjector = {
  entityType: 'site',
  module: 'builder',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.property.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const p = await tx.property.findFirst({ where: { id } });
      if (!p) return null;
      return {
        id: universalId(ctx.tenantId, 'site', p.id),
        tenant_id: ctx.tenantId,
        entity_type: 'site',
        module: 'builder',
        record_id: p.id,
        title: p.name,
        subtitle: p.isPrimary ? `${p.slug} · primary site` : p.slug,
        keywords: keywords([p.slug]),
        status: p.status, // active | paused | archived
        url: '/settings/sites',
        created_at: epoch(p.createdAt),
        updated_at: epoch(p.updatedAt),
      };
    }),
};

// ─── builder: a page of a site ───────────────────────────────────────────────
// The pages an owner builds in the editor: Home, About, Contact, and the one page
// that shows every product. Gillett Diesel typed "About" with the page open in
// the editor behind the box and was told "Nothing in your records matches"
// (sparx persona issue 130): pages were never in the index, though the box says
// it searches everything. Signalled from `@wizeworks/builder`'s page and site
// services (`page-search.ts`) on every write that adds, renames, re-addresses,
// publishes or removes a page.
//
// A page belongs to ONE site, so the subtitle names it and the address carries it:
// an owner with two businesses has two "About" pages, and the link opens the one
// she picked on its own site rather than whichever site the console is on.
// Words come from the row only. No body text: a page's words live in a tree of
// sections, and the name, the address and the search-engine title are what an
// owner types to find the page.

const builderPageProjector: EntityProjector = {
  entityType: 'builder_page',
  module: 'builder',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.builderPage.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const p = await tx.builderPage.findFirst({
        where: { id },
        include: { property: { select: { name: true } } },
      });
      if (!p) return null;
      return {
        id: universalId(ctx.tenantId, 'builder_page', p.id),
        tenant_id: ctx.tenantId,
        entity_type: 'builder_page',
        module: 'builder',
        record_id: p.id,
        title: p.name,
        subtitle: `${pageAddressWords(p.kind, p.slug)} · ${p.property.name}`,
        body: snippet(p.seoDescription),
        keywords: keywords([p.slug, p.seoTitle, p.property.name]),
        status: p.publishedAt ? 'published' : 'draft',
        url: `/builder?pageId=${p.id}&site=${p.propertyId}`,
        created_at: epoch(p.createdAt),
        updated_at: epoch(p.updatedAt),
      };
    }),
};

/** Where a page sits on the site, as the owner reads an address. A page that
 *  shows every product has the address `/products/:handle`; the `:handle` part is
 *  the code's word for "each one", so it is said as "every page under /products/". */
export function pageAddressWords(kind: string, slug: string | null): string {
  const trimmed = (slug ?? '').trim().replace(/^\/+/, '');
  if (kind === 'collection') {
    const base = trimmed.split(':')[0]?.replace(/\/+$/, '') ?? '';
    return base ? `Every page under /${base}/` : 'Every page of one kind';
  }
  return trimmed ? `/${trimmed}` : 'Home page, /';
}

// ─── cms: content entry (signalled live, paired with cms_page) ─────────────
// Covers every ContentEntry typeKey EXCEPT `page`, which cmsPageProjector takes
// (those rows are a tenant's policy and standalone pages). Same table, split on
// one column, so neither indexes the other's rows. Title
// lives in the body JSON — there is no title column. Public search filters
// status:='published'.

const contentEntryProjector: EntityProjector = {
  entityType: 'cms_entry',
  module: 'cms',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.contentEntry.findMany({
        where: { deletedAt: null, typeKey: { not: 'page' } },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const e = await tx.contentEntry.findFirst({ where: { id, deletedAt: null } });
      if (!e || e.typeKey === 'page') return null;
      const body = (e.body ?? {}) as Record<string, unknown>;
      const title =
        pickString(body.title) ??
        pickString(body.name) ??
        pickString(body.heading) ??
        e.slug ??
        `Untitled ${e.typeKey}`;
      return {
        id: universalId(ctx.tenantId, 'cms_entry', e.id),
        tenant_id: ctx.tenantId,
        entity_type: 'cms_entry',
        module: 'cms',
        record_id: e.id,
        title,
        subtitle: `${humanizeTypeKey(e.typeKey)} · ${entryStatusWords(e.status)}`,
        body: snippet(pickString(body.excerpt) ?? pickString(body.summary)),
        keywords: keywords([e.slug, e.typeKey]),
        status: e.status, // draft | published | scheduled | archived
        url: `/cms/${e.id}`,
        created_at: epoch(e.createdAt),
        updated_at: epoch(e.updatedAt),
      };
    }),
};

// ─── cms: media asset ──────────────────────────────────────────────────────
// Signalled on upload reserved, upload completed, metadata edited and deleted.
// media-worker signals again on the 'uploading' -> 'ready' flip, which is a
// FACETED field and the only thing that moves it on a transcoding backend.
// Filename + alt-text + mime search for the ⌘K media-finder use case.

const mediaProjector: EntityProjector = {
  entityType: 'media',
  module: 'cms',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.mediaAsset.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const m = await tx.mediaAsset.findFirst({ where: { id, deletedAt: null } });
      if (!m) return null;
      return {
        id: universalId(ctx.tenantId, 'media', m.id),
        tenant_id: ctx.tenantId,
        entity_type: 'media',
        module: 'cms',
        record_id: m.id,
        title: m.originalFilename,
        subtitle: m.altText ?? fileKindWords(m.mimeType),
        keywords: keywords([m.mimeType, m.altText, m.caption]),
        status: m.status, // uploading | ready | failed
        url: `/cms/media/${m.id}`,
        created_at: epoch(m.createdAt),
        updated_at: epoch(m.updatedAt),
      };
    }),
};

/** Universal projectors contributed by Commerce + CRM. The commerce-indexer
 *  registers these into its projector registry (reindex + event dispatch). */

// ─── inventory: purchasing ─────────────────────────────────────
//
// Seven documents a warehouse refers to by NUMBER every day, none of which was
// searchable until now (issue 508). Each carries the numbers and names AROUND
// it in `keywords`, because a delivery is looked for by its supplier or by the
// order it came from at least as often as by its own number.

const supplierProjector: EntityProjector = {
  entityType: 'supplier',
  module: 'inventory',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.supplier.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const s = await tx.supplier.findFirst({ where: { id, deletedAt: null } });
      if (!s) return null;
      return {
        id: universalId(ctx.tenantId, 'supplier', s.id),
        tenant_id: ctx.tenantId,
        entity_type: 'supplier',
        module: 'inventory',
        record_id: s.id,
        title: s.name,
        subtitle: s.code,
        keywords: keywords([s.code, s.contactName, s.email, s.phone, s.city, s.region, s.country]),
        status: s.isActive ? 'active' : 'inactive',
        url: `/inventory/suppliers/${s.id}`,
        created_at: epoch(s.createdAt),
        updated_at: epoch(s.updatedAt),
      };
    }),
};

const purchaseOrderProjector: EntityProjector = {
  entityType: 'purchase_order',
  module: 'inventory',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.purchaseOrder.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id },
        include: {
          supplier: { select: { name: true, code: true } },
          warehouse: { select: { name: true } },
        },
      });
      if (!po) return null;
      return {
        id: universalId(ctx.tenantId, 'purchase_order', po.id),
        tenant_id: ctx.tenantId,
        entity_type: 'purchase_order',
        module: 'inventory',
        record_id: po.id,
        title: po.number,
        // The supplier, not the status. A list of order numbers all reading
        // "submitted" tells nobody which one they are looking at.
        subtitle: po.supplier?.name ?? undefined,
        keywords: keywords([
          po.supplier?.name,
          po.supplier?.code,
          po.warehouse?.name,
          po.reference,
          po.status,
        ]),
        status: po.status,
        url: `/inventory/purchase-orders/${po.id}`,
        created_at: epoch(po.createdAt),
        updated_at: epoch(po.updatedAt),
      };
    }),
};

const goodsReceiptProjector: EntityProjector = {
  entityType: 'goods_receipt',
  module: 'inventory',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.goodsReceipt.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const r = await tx.goodsReceipt.findFirst({
        where: { id },
        include: {
          purchaseOrder: {
            select: { number: true, supplier: { select: { name: true, code: true } } },
          },
          warehouse: { select: { name: true } },
        },
      });
      if (!r) return null;
      return {
        id: universalId(ctx.tenantId, 'goods_receipt', r.id),
        tenant_id: ctx.tenantId,
        entity_type: 'goods_receipt',
        module: 'inventory',
        record_id: r.id,
        title: r.number,
        subtitle: r.purchaseOrder?.supplier?.name ?? undefined,
        // The ORDER number matters most here: a delivery is almost always
        // looked for from the order it belongs to.
        keywords: keywords([
          r.purchaseOrder?.number,
          r.purchaseOrder?.supplier?.name,
          r.purchaseOrder?.supplier?.code,
          r.warehouse?.name,
          r.reference,
          snippet(r.note, 200),
        ]),
        url: `/inventory/receiving/${r.id}`,
        created_at: epoch(r.createdAt),
        updated_at: epoch(r.createdAt),
      };
    }),
};

const supplierBillProjector: EntityProjector = {
  entityType: 'supplier_bill',
  module: 'inventory',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.supplierBill.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const b = await tx.supplierBill.findFirst({
        where: { id },
        include: {
          supplier: { select: { name: true, code: true } },
          purchaseOrder: { select: { number: true } },
        },
      });
      if (!b) return null;
      return {
        id: universalId(ctx.tenantId, 'supplier_bill', b.id),
        tenant_id: ctx.tenantId,
        entity_type: 'supplier_bill',
        module: 'inventory',
        record_id: b.id,
        // THEIR number, as printed on the paper. That is the only number
        // anybody quotes back on the phone.
        title: b.number,
        subtitle: b.supplier?.name ?? undefined,
        keywords: keywords([
          b.supplier?.name,
          b.supplier?.code,
          b.purchaseOrder?.number,
          b.status,
          b.currency,
        ]),
        status: b.status,
        url: `/inventory/supplier-bills/${b.id}`,
        created_at: epoch(b.createdAt),
        updated_at: epoch(b.updatedAt),
      };
    }),
};

const supplierReturnProjector: EntityProjector = {
  entityType: 'supplier_return',
  module: 'inventory',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.supplierReturn.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const r = await tx.supplierReturn.findFirst({
        where: { id },
        include: {
          supplier: { select: { name: true, code: true } },
          warehouse: { select: { name: true } },
        },
      });
      if (!r) return null;
      return {
        id: universalId(ctx.tenantId, 'supplier_return', r.id),
        tenant_id: ctx.tenantId,
        entity_type: 'supplier_return',
        module: 'inventory',
        record_id: r.id,
        title: r.number,
        subtitle: r.supplier?.name ?? undefined,
        // The RMA number is the one the supplier quotes back, so it has to be
        // findable even though it is not the title.
        keywords: keywords([
          r.supplier?.name,
          r.supplier?.code,
          r.warehouse?.name,
          r.rmaNumber,
          r.reason,
          r.status,
        ]),
        status: r.status,
        url: `/inventory/supplier-returns/${r.id}`,
        created_at: epoch(r.createdAt),
        updated_at: epoch(r.updatedAt),
      };
    }),
};

const inventoryTransferProjector: EntityProjector = {
  entityType: 'inventory_transfer',
  module: 'inventory',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.inventoryTransfer.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const t = await tx.inventoryTransfer.findFirst({
        where: { id },
        include: {
          fromWarehouse: { select: { name: true } },
          toWarehouse: { select: { name: true } },
        },
      });
      if (!t) return null;
      return {
        id: universalId(ctx.tenantId, 'inventory_transfer', t.id),
        tenant_id: ctx.tenantId,
        entity_type: 'inventory_transfer',
        module: 'inventory',
        record_id: t.id,
        title: t.number,
        // Where it went, in the words on the subtitle line, because that is the
        // whole question anybody has about a transfer.
        subtitle:
          t.fromWarehouse && t.toWarehouse
            ? `${t.fromWarehouse.name} to ${t.toWarehouse.name}`
            : undefined,
        keywords: keywords([
          t.fromWarehouse?.name,
          t.toWarehouse?.name,
          t.status,
          snippet(t.note, 200),
        ]),
        status: t.status,
        url: `/inventory/transfers/${t.id}`,
        created_at: epoch(t.createdAt),
        updated_at: epoch(t.updatedAt),
      };
    }),
};

const inventoryCountProjector: EntityProjector = {
  entityType: 'inventory_count',
  module: 'inventory',
  listIdsForTenant: (ctx: ProjectorContext) =>
    withTenant(ctx, async (tx) => {
      const rows = await tx.inventoryCount.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }),
  project: (ctx: ProjectorContext, id: string) =>
    withTenant(ctx, async (tx): Promise<UniversalSearchDocument | null> => {
      const c = await tx.inventoryCount.findFirst({
        where: { id },
        include: { warehouse: { select: { name: true } } },
      });
      if (!c) return null;
      return {
        id: universalId(ctx.tenantId, 'inventory_count', c.id),
        tenant_id: ctx.tenantId,
        entity_type: 'inventory_count',
        module: 'inventory',
        record_id: c.id,
        title: c.number,
        subtitle: c.warehouse?.name ?? undefined,
        keywords: keywords([c.warehouse?.name, c.zoneName, c.type, c.scope, c.status]),
        status: c.status,
        url: `/inventory/counts/${c.id}`,
        created_at: epoch(c.createdAt),
        updated_at: epoch(c.updatedAt),
      };
    }),
};

export const commerceUniversalProjectors: EntityProjector[] = [
  // Phase 1 (shipped)
  warehouseProjector,
  discountProjector,
  giftCardProjector,
  b2bAccountProjector,
  billingDocumentProjector,
  quoteProjector,
  // Phase 2 — breadth (commerce)
  collectionProjector,
  categoryProjector,
  bundleProjector,
  subscriptionProjector,
  reviewProjector,
  returnProjector,
  // Phase 2 — breadth (crm)
  segmentProjector,
  pipelineProjector,
  dealProjector,
  taskProjector,
  // Public storefront content (also powers global ⌘K)
  productProjector,
  cmsPageProjector,
  // Site Builder + CMS breadth (docs/39 Ph2 / docs/66)
  siteProjector,
  builderPageProjector,
  contentEntryProjector,
  mediaProjector,
  // Purchasing (issue 508). A warehouse refers to its own paperwork by number,
  // and not one of these numbers used to find anything.
  supplierProjector,
  purchaseOrderProjector,
  goodsReceiptProjector,
  supplierBillProjector,
  supplierReturnProjector,
  inventoryTransferProjector,
  inventoryCountProjector,
];

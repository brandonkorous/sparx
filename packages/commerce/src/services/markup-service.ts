// markupService — catalog markup rules (docs/48 Phase 1).
//
// A markup rule turns a variant's COST into a charged price. The math lives
// in the pure `applyMarkupRule` (@sparx/commerce-schemas, also used client-
// side and by the recompute worker); this service owns persistence, scope
// resolution, and the bind/recompute writes.
//
// Resolution position: markup is a cost→LIST function and runs BEFORE the
// B2B tier / discount resolution order (docs/48 §4). When a variant is bound
// to a catalog rule its `priceCents` is DERIVED and an `appliedMarkup`
// snapshot is stamped so the price is reproducible after the cost drifts.
//
// All writes follow the locked pattern: validate → withTenant() tx →
// writeAuditLog in-tx → publishCommerceEvent after commit.

import {
  CreateMarkupRuleInput,
  priceVariantByRule,
  UpdateMarkupRuleInput,
  type AppliedMarkupSnapshot,
  type MarkupBand,
  type MarkupCostBasis,
  MarkupScope,
  type MarkupResult,
  type MarkupRuleSpec,
  type RoundingSpec,
} from '@sparx/commerce-schemas';
import { Prisma, withTenant } from '@sparx/db';
import type { MarkupRule } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { CommerceNotFoundError, CommerceValidationError } from '../errors';
import type { ServiceContext } from '../errors';
import { publishCommerceEvent } from '../events';

// Hard cap on how many variants a single apply/preview touches in one pass.
// Larger catalogs route through the Phase 4 recompute worker.
const SCOPE_CAP = 5000;
const PREVIEW_DISPLAY_LIMIT = 250;

// ─── Public shapes ────────────────────────────────────────────────────

export interface MarkupRuleRow {
  id: string;
  name: string;
  method: string;
  value: number | null;
  bands: MarkupBand[];
  costBasis: string;
  rounding: RoundingSpec;
  floorProfitCents: number | null;
  floorMargin: number | null;
  ceilingSrc: string;
  ceilingValueCents: number | null;
  appliesTo: string;
  scope: MarkupScope;
  priority: number;
  isActive: boolean;
  recomputeMode: string;
  recomputeTolerancePct: number | null;
  boundVariantCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MarkupPreviewLine {
  variantId: string;
  productId: string;
  sku: string;
  title: string | null;
  costCents: number | null;
  currentPriceCents: number;
  newPriceCents: number | null;
  profitCents: number | null;
  marginPct: number | null;
  markupPct: number | null;
  method: string | null;
  /** True when the variant has no usable cost — it can't be priced by rule. */
  unpriceable: boolean;
}

export interface MarkupPreviewResult {
  ruleId: string;
  scope: MarkupScope;
  totalVariants: number;
  pricedVariants: number;
  unpriceableVariants: number;
  truncated: boolean;
  lines: MarkupPreviewLine[];
}

export interface MarkupApplyResult {
  ruleId: string;
  applied: number;
  skipped: number;
  capped: boolean;
}

// ─── Rule CRUD ────────────────────────────────────────────────────────

export async function listRules(
  ctx: ServiceContext,
  filter: { appliesTo?: string; isActive?: boolean } = {}
): Promise<MarkupRuleRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.markupRule.findMany({
      where: {
        ...(filter.appliesTo ? { appliesTo: filter.appliesTo } : {}),
        ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
      },
      include: { _count: { select: { variants: true } } },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      take: 500,
    });
    return rows.map(serializeRule);
  });
}

export async function getRule(ctx: ServiceContext, id: string): Promise<MarkupRuleRow> {
  const row = await withTenant(ctx, (tx) =>
    tx.markupRule.findFirst({
      where: { id },
      include: { _count: { select: { variants: true } } },
    })
  );
  if (!row) throw new CommerceNotFoundError('MarkupRule', id);
  return serializeRule(row);
}

export async function createRule(ctx: ServiceContext, rawInput: unknown): Promise<MarkupRuleRow> {
  const input = CreateMarkupRuleInput.parse(rawInput);

  const row = await withTenant(ctx, async (tx) => {
    const created = await tx.markupRule.create({
      data: { tenantId: ctx.tenantId, ...toCreateData(input) },
      include: { _count: { select: { variants: true } } },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.markup_rule.created',
      entityType: 'MarkupRule',
      entityId: created.id,
      diff: { after: { name: created.name, method: created.method } },
    });
    return created;
  });

  return serializeRule(row);
}

export async function updateRule(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<MarkupRuleRow> {
  const input = UpdateMarkupRuleInput.parse(rawInput);

  const row = await withTenant(ctx, async (tx) => {
    const before = await tx.markupRule.findFirst({ where: { id } });
    if (!before) throw new CommerceNotFoundError('MarkupRule', id);

    const updated = await tx.markupRule.update({
      where: { id },
      data: toUpdateData(input),
      include: { _count: { select: { variants: true } } },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.markup_rule.updated',
      entityType: 'MarkupRule',
      entityId: id,
      diff: { before: { name: before.name }, after: { name: updated.name } },
    });
    return updated;
  });

  return serializeRule(row);
}

export async function deleteRule(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const before = await tx.markupRule.findFirst({ where: { id } });
    if (!before) throw new CommerceNotFoundError('MarkupRule', id);
    // Bound variants FK SET NULL → they keep their last price but detach to
    // manual pricing. Their applied_markup snapshot stays for the record.
    await tx.markupRule.delete({ where: { id } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.markup_rule.deleted',
      entityType: 'MarkupRule',
      entityId: id,
      diff: { before: { name: before.name } },
    });
  });
}

// ─── Single-variant bind / unbind (the variant editor "Price by rule") ──

export async function bindVariant(
  ctx: ServiceContext,
  variantId: string,
  ruleId: string
): Promise<{ variantId: string; priceCents: number; result: MarkupResult }> {
  const out = await withTenant(ctx, async (tx) => {
    const variant = await tx.productVariant.findFirst({
      where: { id: variantId, deletedAt: null },
    });
    if (!variant) throw new CommerceNotFoundError('Variant', variantId);

    const rule = await tx.markupRule.findFirst({ where: { id: ruleId } });
    if (!rule) throw new CommerceNotFoundError('MarkupRule', ruleId);

    const supplier = await supplierCostFor(tx, rule.costBasis as MarkupCostBasis, [
      variant.productId,
    ]);
    const priced = priceVariant(variant, rule, supplier);
    if (!priced) {
      throw new CommerceValidationError('Variant has no cost to price from', [
        { field: 'costCents', message: 'Set a cost before pricing this variant by rule' },
      ]);
    }

    await tx.productVariant.update({
      where: { id: variantId },
      data: {
        priceCents: priced.result.priceCents,
        markupRuleId: ruleId,
        appliedMarkup: priced.snapshot,
      },
    });
    await refreshProductPriceRange(tx, variant.productId);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.variant.priced_by_rule',
      entityType: 'Variant',
      entityId: variantId,
      diff: {
        before: { priceCents: variant.priceCents, markupRuleId: variant.markupRuleId },
        after: { priceCents: priced.result.priceCents, markupRuleId: ruleId },
      },
    });

    return { productId: variant.productId, result: priced.result };
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'variant.updated',
    data: { variantId, productId: out.productId, change: 'price' },
  });

  return { variantId, priceCents: out.result.priceCents, result: out.result };
}

export async function unbindVariant(ctx: ServiceContext, variantId: string): Promise<void> {
  const out = await withTenant(ctx, async (tx) => {
    const variant = await tx.productVariant.findFirst({
      where: { id: variantId, deletedAt: null },
    });
    if (!variant) throw new CommerceNotFoundError('Variant', variantId);
    if (variant.markupRuleId == null) return { productId: variant.productId };

    await tx.productVariant.update({
      where: { id: variantId },
      data: { markupRuleId: null, appliedMarkup: Prisma.DbNull },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.variant.pricing_detached',
      entityType: 'Variant',
      entityId: variantId,
      diff: { before: { markupRuleId: variant.markupRuleId }, after: { markupRuleId: null } },
    });
    return { productId: variant.productId };
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'variant.updated',
    data: { variantId, productId: out.productId, change: 'pricing_detached' },
  });
}

// ─── Single-variant margin (read) ──────────────────────────────────────

export interface VariantMargin {
  variantId: string;
  sku: string;
  /** Unit cost in cents; null when the variant carries no cost. */
  costCents: number | null;
  /** Current charged price in cents. */
  priceCents: number;
  /** price − cost; null without a cost. */
  profitCents: number | null;
  /** profit / price, as a 0–1 fraction; null without a cost or at zero price. */
  marginPct: number | null;
  /** profit / cost, as a 0–1 fraction; null without a positive cost. */
  markupPct: number | null;
  /** The catalog markup rule this variant's price is derived from, if any. */
  markupRuleId: string | null;
  /** The reproducible snapshot stamped when a rule priced this variant, if any. */
  appliedMarkup: AppliedMarkupSnapshot | null;
}

const round4 = (n: number): number => Math.round(n * 10_000) / 10_000;

/** Current cost / price / margin breakdown for one variant — whether its price
 *  is rule-derived or manually set. Read-only; the MCP `get_margin` tool wraps it. */
export async function getVariantMargin(
  ctx: ServiceContext,
  variantId: string
): Promise<VariantMargin> {
  return withTenant(ctx, async (tx) => {
    const v = await tx.productVariant.findFirst({
      where: { id: variantId },
      select: {
        id: true,
        sku: true,
        costCents: true,
        priceCents: true,
        markupRuleId: true,
        appliedMarkup: true,
      },
    });
    if (!v) throw new CommerceNotFoundError('ProductVariant', variantId);

    const profitCents = v.costCents == null ? null : v.priceCents - v.costCents;
    const marginPct =
      profitCents == null || v.priceCents === 0 ? null : round4(profitCents / v.priceCents);
    const markupPct =
      profitCents == null || !v.costCents ? null : round4(profitCents / v.costCents);

    return {
      variantId: v.id,
      sku: v.sku,
      costCents: v.costCents,
      priceCents: v.priceCents,
      profitCents,
      marginPct,
      markupPct,
      markupRuleId: v.markupRuleId,
      appliedMarkup: (v.appliedMarkup ?? null) as AppliedMarkupSnapshot | null,
    };
  });
}

// ─── Scope-wide preview / apply (the bulk pricing tool) ─────────────────

export async function previewRule(
  ctx: ServiceContext,
  id: string,
  rawScopeOverride?: unknown
): Promise<MarkupPreviewResult> {
  const scopeOverride = rawScopeOverride == null ? undefined : MarkupScope.parse(rawScopeOverride);
  return withTenant(ctx, async (tx) => {
    const rule = await tx.markupRule.findFirst({ where: { id } });
    if (!rule) throw new CommerceNotFoundError('MarkupRule', id);

    const scope = scopeOverride ?? toScope(rule.scope);
    const where = scopeWhere(scope, ctx.tenantId);

    const totalVariants = await tx.productVariant.count({ where });
    const variants = await tx.productVariant.findMany({
      where,
      orderBy: [{ productId: 'asc' }, { position: 'asc' }],
      take: PREVIEW_DISPLAY_LIMIT,
      include: { product: { select: { title: true } } },
    });

    const supplier = await supplierCostFor(
      tx,
      rule.costBasis as MarkupCostBasis,
      variants.map((v) => v.productId)
    );

    let priced = 0;
    let unpriceable = 0;
    const lines: MarkupPreviewLine[] = variants.map((v) => {
      const out = priceVariant(v, rule, supplier);
      if (out) priced += 1;
      else unpriceable += 1;
      return {
        variantId: v.id,
        productId: v.productId,
        sku: v.sku,
        title: v.title ?? v.product.title,
        costCents: out?.costCents ?? v.costCents,
        currentPriceCents: v.priceCents,
        newPriceCents: out?.result.priceCents ?? null,
        profitCents: out?.result.profitCents ?? null,
        marginPct: out?.result.marginPct ?? null,
        markupPct: out?.result.markupPct ?? null,
        method: out?.result.method ?? null,
        unpriceable: !out,
      };
    });

    return {
      ruleId: id,
      scope,
      totalVariants,
      pricedVariants: priced,
      unpriceableVariants: unpriceable,
      truncated: totalVariants > variants.length,
      lines,
    };
  });
}

export async function applyRule(
  ctx: ServiceContext,
  id: string,
  rawScopeOverride?: unknown
): Promise<MarkupApplyResult> {
  const scopeOverride = rawScopeOverride == null ? undefined : MarkupScope.parse(rawScopeOverride);
  const out = await withTenant(ctx, async (tx) => {
    const rule = await tx.markupRule.findFirst({ where: { id } });
    if (!rule) throw new CommerceNotFoundError('MarkupRule', id);

    const scope = scopeOverride ?? toScope(rule.scope);
    const where = scopeWhere(scope, ctx.tenantId);

    const total = await tx.productVariant.count({ where });
    const capped = total > SCOPE_CAP;

    const variants = await tx.productVariant.findMany({
      where,
      orderBy: [{ productId: 'asc' }, { position: 'asc' }],
      take: SCOPE_CAP,
    });

    const supplier = await supplierCostFor(
      tx,
      rule.costBasis as MarkupCostBasis,
      variants.map((v) => v.productId)
    );

    let applied = 0;
    let skipped = 0;
    const touchedProducts = new Set<string>();

    for (const v of variants) {
      const priced = priceVariant(v, rule, supplier);
      if (!priced) {
        skipped += 1;
        continue;
      }
      await tx.productVariant.update({
        where: { id: v.id },
        data: {
          priceCents: priced.result.priceCents,
          markupRuleId: rule.id,
          appliedMarkup: priced.snapshot,
        },
      });
      applied += 1;
      touchedProducts.add(v.productId);
    }

    for (const productId of touchedProducts) {
      await refreshProductPriceRange(tx, productId);
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.markup_rule.applied',
      entityType: 'MarkupRule',
      entityId: id,
      diff: { after: { applied, skipped, scope } },
    });

    return { applied, skipped, capped, touchedProducts: [...touchedProducts] };
  });

  // Reindex each touched product (carries the price range) off the bus.
  for (const productId of out.touchedProducts) {
    await publishCommerceEvent({
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      topic: 'product.updated',
      data: { productId, change: 'markup_applied' },
    });
  }

  return { ruleId: id, applied: out.applied, skipped: out.skipped, capped: out.capped };
}

// ─── Internal: pricing one variant ──────────────────────────────────────

interface VariantForPricing {
  id: string;
  productId: string;
  costCents: number | null;
  compareAtPriceCents: number | null;
}

interface PricedVariant {
  costCents: number;
  result: MarkupResult;
  snapshot: AppliedMarkupSnapshot;
}

function priceVariant(
  variant: VariantForPricing,
  rule: MarkupRule,
  supplier: SupplierCost
): PricedVariant | null {
  const basis = rule.costBasis as MarkupCostBasis;
  const supplierCost = supplier.costByProduct.get(variant.productId);
  const costCents =
    basis === 'supplier_cost' ? (supplierCost ?? variant.costCents) : variant.costCents;
  if (costCents == null) return null;

  // Same pure engine + snapshot builder the recompute worker uses (docs/48 §8) —
  // one source of truth keeps the two catalog write paths from drifting.
  const { result, snapshot } = priceVariantByRule(
    costCents,
    rule.id,
    ruleToSpec(rule),
    basis,
    new Date().toISOString(),
    {
      compareAtCents: variant.compareAtPriceCents,
      msrpCents: supplier.msrpByProduct.get(variant.productId) ?? null,
    }
  );
  return { costCents, result, snapshot };
}

function ruleToSpec(rule: MarkupRule): MarkupRuleSpec {
  return {
    method: rule.method as MarkupRuleSpec['method'],
    value: rule.value == null ? null : Number(rule.value),
    bands: (rule.bands as unknown as MarkupBand[]) ?? [],
    rounding: (rule.rounding as unknown as RoundingSpec) ?? null,
    floorProfitCents: rule.floorProfitCents,
    floorMargin: rule.floorMargin == null ? null : Number(rule.floorMargin),
    ceilingSrc: rule.ceilingSrc as MarkupRuleSpec['ceilingSrc'],
    ceilingValueCents: rule.ceilingValueCents,
  };
}

// ─── Internal: cost-basis + scope resolution ────────────────────────────

interface SupplierCost {
  costByProduct: Map<string, number>;
  msrpByProduct: Map<string, number>;
}

// For supplier_cost / msrp ceiling we read the linked dropship product's cost.
// Product-level (the dropship link maps product→dropship product); returned as
// maps so a batch of variants resolves with one query.
async function supplierCostFor(
  tx: Prisma.TransactionClient,
  basis: MarkupCostBasis,
  productIds: string[]
): Promise<SupplierCost> {
  const empty: SupplierCost = { costByProduct: new Map(), msrpByProduct: new Map() };
  if (basis !== 'supplier_cost' || productIds.length === 0) return empty;

  const links = await tx.dropshipProductLink.findMany({
    where: { productId: { in: [...new Set(productIds)] } },
    include: { dropshipProduct: { select: { costPriceCents: true, msrpCents: true } } },
  });
  for (const link of links) {
    if (!empty.costByProduct.has(link.productId)) {
      empty.costByProduct.set(link.productId, link.dropshipProduct.costPriceCents);
      if (link.dropshipProduct.msrpCents != null) {
        empty.msrpByProduct.set(link.productId, link.dropshipProduct.msrpCents);
      }
    }
  }
  return empty;
}

function scopeWhere(scope: MarkupScope, tenantId: string): Prisma.ProductVariantWhereInput {
  const base: Prisma.ProductVariantWhereInput = {
    tenantId,
    deletedAt: null,
    product: { deletedAt: null },
  };
  switch (scope.type) {
    case 'all':
      return base;
    case 'collection':
      return {
        ...base,
        product: {
          deletedAt: null,
          collectionLinks: { some: { collectionId: { in: scope.ids } } },
        },
      };
    case 'product_type':
      return { ...base, product: { deletedAt: null, productType: scope.value } };
    case 'vendor':
      return { ...base, product: { deletedAt: null, vendor: scope.value } };
    case 'products':
      return { ...base, productId: { in: scope.ids } };
  }
}

function toScope(raw: Prisma.JsonValue): MarkupScope {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'type' in raw) {
    return raw as unknown as MarkupScope;
  }
  return { type: 'all' };
}

async function refreshProductPriceRange(
  tx: Prisma.TransactionClient,
  productId: string
): Promise<void> {
  const range = await tx.productVariant.aggregate({
    where: { productId, deletedAt: null },
    _min: { priceCents: true },
    _max: { priceCents: true },
  });
  await tx.product.update({
    where: { id: productId },
    data: {
      priceMinCents: range._min.priceCents ?? null,
      priceMaxCents: range._max.priceCents ?? null,
    },
  });
}

// ─── Internal: serialization + write mapping ────────────────────────────

function serializeRule(rule: MarkupRule & { _count?: { variants: number } }): MarkupRuleRow {
  return {
    id: rule.id,
    name: rule.name,
    method: rule.method,
    value: rule.value == null ? null : Number(rule.value),
    bands: (rule.bands as unknown as MarkupBand[]) ?? [],
    costBasis: rule.costBasis,
    rounding: (rule.rounding as unknown as RoundingSpec) ?? { strategy: 'none' },
    floorProfitCents: rule.floorProfitCents,
    floorMargin: rule.floorMargin == null ? null : Number(rule.floorMargin),
    ceilingSrc: rule.ceilingSrc,
    ceilingValueCents: rule.ceilingValueCents,
    appliesTo: rule.appliesTo,
    scope: toScope(rule.scope),
    priority: rule.priority,
    isActive: rule.isActive,
    recomputeMode: rule.recomputeMode,
    recomputeTolerancePct:
      rule.recomputeTolerancePct == null ? null : Number(rule.recomputeTolerancePct),
    boundVariantCount: rule._count?.variants ?? 0,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

type RuleWriteInput = Partial<{
  name: string;
  method: string;
  value: number | null;
  bands: MarkupBand[];
  costBasis: string;
  rounding: RoundingSpec;
  floorProfitCents: number | null;
  floorMargin: number | null;
  ceilingSrc: string;
  ceilingValueCents: number | null;
  appliesTo: string;
  scope: MarkupScope;
  priority: number;
  isActive: boolean;
  recomputeMode: string;
  recomputeTolerancePct: number | null;
}>;

function toCreateData(
  input: RuleWriteInput
): Omit<Prisma.MarkupRuleUncheckedCreateInput, 'tenantId'> {
  return {
    name: input.name!,
    method: input.method!,
    value: input.value ?? null,
    bands: input.bands ?? [],
    costBasis: input.costBasis ?? 'variant_cost',
    rounding: input.rounding ?? {},
    floorProfitCents: input.floorProfitCents ?? null,
    floorMargin: input.floorMargin ?? null,
    ceilingSrc: input.ceilingSrc ?? 'none',
    ceilingValueCents: input.ceilingValueCents ?? null,
    appliesTo: input.appliesTo ?? 'catalog',
    scope: input.scope ?? { type: 'all' },
    priority: input.priority ?? 0,
    isActive: input.isActive ?? true,
    recomputeMode: input.recomputeMode ?? 'auto',
    recomputeTolerancePct: input.recomputeTolerancePct ?? null,
  };
}

function toUpdateData(input: RuleWriteInput): Prisma.MarkupRuleUncheckedUpdateInput {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.method !== undefined ? { method: input.method } : {}),
    ...(input.value !== undefined ? { value: input.value } : {}),
    ...(input.bands !== undefined ? { bands: input.bands } : {}),
    ...(input.costBasis !== undefined ? { costBasis: input.costBasis } : {}),
    ...(input.rounding !== undefined ? { rounding: input.rounding } : {}),
    ...(input.floorProfitCents !== undefined ? { floorProfitCents: input.floorProfitCents } : {}),
    ...(input.floorMargin !== undefined ? { floorMargin: input.floorMargin } : {}),
    ...(input.ceilingSrc !== undefined ? { ceilingSrc: input.ceilingSrc } : {}),
    ...(input.ceilingValueCents !== undefined
      ? { ceilingValueCents: input.ceilingValueCents }
      : {}),
    ...(input.appliesTo !== undefined ? { appliesTo: input.appliesTo } : {}),
    ...(input.scope !== undefined ? { scope: input.scope } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.recomputeMode !== undefined ? { recomputeMode: input.recomputeMode } : {}),
    ...(input.recomputeTolerancePct !== undefined
      ? { recomputeTolerancePct: input.recomputeTolerancePct }
      : {}),
  };
}

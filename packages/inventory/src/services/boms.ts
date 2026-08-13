// Bills of materials — the recipe (docs/146 Phase 6.4, 6.7).
//
// A bill says what a finished thing is made of. It moves no stock by itself; an
// assembly order built to it does. Keeping the two apart is what lets a recipe
// be edited, versioned and archived without touching anything already made.
//
// ── Quantities are per BATCH ─────────────────────────────────────────────────
//
// `outputQuantity` is how many finished units one run makes, and every component
// quantity is what the WHOLE batch needs. A run of 100 needing three litres of
// glue records 3 against a batch of 100. Per-unit would record 0.03, and the
// ledger stores integers.
//
// ── The read that earns the feature ──────────────────────────────────────────
//
// `buildableQuantity` answers "how many can I make right now" AND names the
// component that runs out first. The first half is a number; the second half is
// what turns it into a purchase order. A screen that says only "14" leaves
// someone to work out why, across a recipe of thirty parts.

import {
  CreateBomInput,
  SetBomStatusInput,
  UpdateBomInput,
  buildableFrom,
  requiredForRun,
} from '@sparx/commerce-schemas';
import type { BomStatus } from '@sparx/commerce-schemas';
import { Prisma, withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import {
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryValidationError,
} from '../errors';
import type { ServiceContext } from '../errors';

// ─── Row shapes ────────────────────────────────────────────────────────────────

export interface BomComponentRow {
  id: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  /** Base units the whole batch needs. */
  quantityPer: number;
  scrapPercent: number;
  /** quantityPer plus scrap, rounded up — what a run of one batch really pulls. */
  quantityWithScrap: number;
  position: number;
  notes: string | null;
}

export interface BomRow {
  id: string;
  outputVariantId: string;
  outputSku: string | null;
  outputTitle: string | null;
  name: string;
  version: number;
  status: BomStatus;
  outputQuantity: number;
  laborCostCents: number;
  componentCount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BomDetail extends BomRow {
  components: BomComponentRow[];
  /** What one finished unit costs to make at today's component costs — the
   *  ESTIMATE. What it actually costs is settled when a run completes, from what
   *  genuinely left the shelf. Both are useful and they are not the same number. */
  estimatedUnitCostCents: number;
  estimatedComponentCostCents: number;
}

const COMPONENT_INCLUDE = {
  // `costCents` is the catalogue's planned cost — the only figure available
  // without naming a location, which is what makes the estimate below a
  // property of the RECIPE rather than of whichever warehouse you were looking
  // at when you opened it.
  variant: { select: { sku: true, costCents: true, product: { select: { title: true } } } },
} satisfies Prisma.BomComponentInclude;

const DETAIL_INCLUDE = {
  outputVariant: { select: { sku: true, product: { select: { title: true } } } },
  components: { orderBy: { position: 'asc' }, include: COMPONENT_INCLUDE },
} satisfies Prisma.BillOfMaterialsInclude;

type BomWithAll = Prisma.BillOfMaterialsGetPayload<{ include: typeof DETAIL_INCLUDE }>;

// ─── Reads ─────────────────────────────────────────────────────────────────────

export async function listBoms(
  ctx: ServiceContext,
  filter: {
    q?: string;
    status?: BomStatus;
    outputVariantId?: string;
    take?: number;
    skip?: number;
  } = {}
): Promise<{ items: BomRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where: Prisma.BillOfMaterialsWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.outputVariantId ? { outputVariantId: filter.outputVariantId } : {}),
      ...(filter.q
        ? {
            OR: [
              { name: { contains: filter.q, mode: 'insensitive' } },
              { outputVariant: { sku: { contains: filter.q, mode: 'insensitive' } } },
              {
                outputVariant: {
                  product: { title: { contains: filter.q, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      tx.billOfMaterials.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        take: Math.min(filter.take ?? 50, 250),
        skip: filter.skip ?? 0,
        include: DETAIL_INCLUDE,
      }),
      tx.billOfMaterials.count({ where }),
    ]);
    return { items: rows.map(serializeRow), total };
  });
}

export async function getBom(ctx: ServiceContext, id: string): Promise<BomDetail> {
  return withTenant(ctx, (tx) => loadBomDetail(tx, id));
}

/** The bill a run should be built to: the ACTIVE one for this output, if any. */
export async function activeBomFor(
  ctx: ServiceContext,
  outputVariantId: string
): Promise<BomDetail | null> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.billOfMaterials.findFirst({
      where: { outputVariantId, status: 'active' },
      include: DETAIL_INCLUDE,
    });
    return row ? serializeDetail(row) : null;
  });
}

// ─── Writes ────────────────────────────────────────────────────────────────────

export async function createBom(ctx: ServiceContext, rawInput: unknown): Promise<BomDetail> {
  const input = CreateBomInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    await assertVariantsExist(tx, [
      input.outputVariantId,
      ...input.components.map((c) => c.variantId),
    ]);
    assertNoSelfReference(
      input.outputVariantId,
      input.components.map((c) => c.variantId)
    );
    assertNoDuplicateComponents(input.components.map((c) => c.variantId));

    // Versions climb per output variant, so "version 3 of the shelf kit" means
    // something even after the first two were archived.
    const latest = await tx.billOfMaterials.findFirst({
      where: { outputVariantId: input.outputVariantId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const bom = await tx.billOfMaterials.create({
      data: {
        tenantId: ctx.tenantId,
        outputVariantId: input.outputVariantId,
        name: input.name,
        version: (latest?.version ?? 0) + 1,
        outputQuantity: input.outputQuantity ?? 1,
        laborCostCents: input.laborCostCents ?? 0,
        notes: input.notes ?? null,
      },
      select: { id: true },
    });

    await writeComponents(tx, ctx.tenantId, bom.id, input.components);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.bom.created',
      entityType: 'BillOfMaterials',
      entityId: bom.id,
      diff: { after: { name: input.name, components: input.components.length } },
    });

    return loadBomDetail(tx, bom.id);
  });
}

export async function updateBom(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<BomDetail> {
  const input = UpdateBomInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const existing = await tx.billOfMaterials.findFirst({
      where: { id },
      select: { id: true, status: true, outputVariantId: true },
    });
    if (!existing) throw new InventoryNotFoundError('BillOfMaterials', id);

    // An archived recipe is history — assembly orders point at it and say what
    // they were built to. Editing one would change what a completed batch
    // claims to be made of.
    if (existing.status === 'archived') {
      throw new InventoryConflictError(
        'This recipe is archived. Copy it to a new version rather than editing what past runs were built to.',
        'status'
      );
    }

    if (input.components) {
      await assertVariantsExist(
        tx,
        input.components.map((c) => c.variantId)
      );
      assertNoSelfReference(
        existing.outputVariantId,
        input.components.map((c) => c.variantId)
      );
      assertNoDuplicateComponents(input.components.map((c) => c.variantId));
    }

    await tx.billOfMaterials.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.outputQuantity !== undefined ? { outputQuantity: input.outputQuantity } : {}),
        ...(input.laborCostCents !== undefined ? { laborCostCents: input.laborCostCents } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    if (input.components) {
      await tx.bomComponent.deleteMany({ where: { bomId: id } });
      await writeComponents(tx, ctx.tenantId, id, input.components);
    }

    return loadBomDetail(tx, id);
  });
}

/**
 * Move a recipe between draft, active and archived.
 *
 * Activating one stands the previous active version DOWN rather than refusing.
 * "Make this the recipe we build to" is what the person meant, and making them
 * archive the old one first is a step that teaches nothing and that the database
 * would otherwise refuse mid-way through with a unique-index error.
 */
export async function setBomStatus(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<BomDetail> {
  const input = SetBomStatusInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const existing = await tx.billOfMaterials.findFirst({
      where: { id },
      select: {
        id: true,
        outputVariantId: true,
        status: true,
        components: { select: { id: true } },
      },
    });
    if (!existing) throw new InventoryNotFoundError('BillOfMaterials', id);

    if (input.status === 'active') {
      if (existing.components.length === 0) {
        throw new InventoryValidationError(
          'A recipe with no components cannot be the one you build to — add what it is made of first.',
          [{ field: 'status', message: 'no components' }]
        );
      }
      await tx.billOfMaterials.updateMany({
        where: { outputVariantId: existing.outputVariantId, status: 'active', id: { not: id } },
        data: { status: 'archived' },
      });
    }

    await tx.billOfMaterials.update({ where: { id }, data: { status: input.status } });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.bom.status_changed',
      entityType: 'BillOfMaterials',
      entityId: id,
      diff: { before: { status: existing.status }, after: { status: input.status } },
    });

    return loadBomDetail(tx, id);
  });
}

/** Delete a recipe. Refused once a run has been built to it — the run points at
 *  it to say what it was made of, and archiving is what "stop using this" means. */
export async function deleteBom(ctx: ServiceContext, id: string): Promise<{ id: string }> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.billOfMaterials.findFirst({
      where: { id },
      select: { id: true, _count: { select: { assemblyOrders: true } } },
    });
    if (!existing) throw new InventoryNotFoundError('BillOfMaterials', id);
    if (existing._count.assemblyOrders > 0) {
      throw new InventoryConflictError(
        `${String(existing._count.assemblyOrders)} run${existing._count.assemblyOrders === 1 ? ' has' : 's have'} been built to this recipe and point at it to say what they were made of. Archive it instead.`,
        'id'
      );
    }
    await tx.billOfMaterials.delete({ where: { id } });
    return { id };
  });
}

// ─── Buildable quantity ────────────────────────────────────────────────────────

export interface BuildableComponentRow {
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  /** Base units one batch needs, scrap included. */
  requiredPerBatch: number;
  /** What is sellable at the location right now. */
  available: number;
  /** Finished units this component alone would allow. */
  supports: number;
  /** True for the one that runs out first — the reason the answer is what it is. */
  isLimiting: boolean;
}

export interface BuildableReport {
  bomId: string;
  outputVariantId: string;
  outputSku: string | null;
  warehouseId: string;
  /** Finished units the stock on hand allows, rounded down to whole batches. */
  quantity: number;
  outputQuantityPerBatch: number;
  /** The component that runs out first. Null only when the recipe has none. */
  limitingVariantId: string | null;
  limitingSku: string | null;
  components: BuildableComponentRow[];
}

/**
 * How many finished units the stock at one location allows.
 *
 * Measured against AVAILABLE, not on-hand: units already promised to a customer
 * order cannot also be built into something else, and a buildable figure that
 * counted them would send someone to a shelf that is spoken for.
 *
 * Rounds down to whole batches, because half a run is not a thing you can make.
 */
export async function buildableQuantity(
  ctx: ServiceContext,
  params: { bomId: string; warehouseId: string }
): Promise<BuildableReport> {
  return withTenant(ctx, async (tx) => {
    const bom = await tx.billOfMaterials.findFirst({
      where: { id: params.bomId },
      include: DETAIL_INCLUDE,
    });
    if (!bom) throw new InventoryNotFoundError('BillOfMaterials', params.bomId);

    const variantIds = bom.components.map((c) => c.variantId);
    const levels =
      variantIds.length === 0
        ? []
        : await tx.inventoryLevel.findMany({
            where: { variantId: { in: variantIds }, warehouseId: params.warehouseId },
            select: {
              variantId: true,
              onHand: true,
              allocated: true,
              safetyBuffer: true,
              unsellableOnHand: true,
            },
          });
    const availableByVariant = new Map(
      levels.map((l) => [
        l.variantId,
        Math.max(0, l.onHand - l.allocated - l.safetyBuffer - l.unsellableOnHand),
      ])
    );

    const components = bom.components.map((c) => {
      const requiredPerBatch = requiredForRun({
        quantityPerBatch: c.quantityPer,
        outputPerBatch: bom.outputQuantity,
        runQuantity: bom.outputQuantity,
        scrapPercent: Number(c.scrapPercent),
      });
      const available = availableByVariant.get(c.variantId) ?? 0;
      return {
        variantId: c.variantId,
        variantSku: c.variant?.sku ?? null,
        productTitle: c.variant?.product?.title ?? null,
        requiredPerBatch,
        available,
        // How many FINISHED units this component alone would allow: whole
        // batches it covers, times what a batch makes.
        supports:
          requiredPerBatch > 0
            ? Math.floor(available / requiredPerBatch) * bom.outputQuantity
            : Number.MAX_SAFE_INTEGER,
      };
    });

    const { quantity, limitingVariantId } = buildableFrom(
      components.map((c) => ({
        variantId: c.variantId,
        requiredPerBatch: c.requiredPerBatch,
        available: c.available,
        supports: c.supports,
      })),
      bom.outputQuantity
    );

    return {
      bomId: bom.id,
      outputVariantId: bom.outputVariantId,
      outputSku: bom.outputVariant?.sku ?? null,
      warehouseId: params.warehouseId,
      quantity,
      outputQuantityPerBatch: bom.outputQuantity,
      limitingVariantId,
      limitingSku: components.find((c) => c.variantId === limitingVariantId)?.variantSku ?? null,
      components: components.map((c) => ({
        ...c,
        // A component with no requirement supports an unbounded number, which is
        // true and unprintable; clamp it for display.
        supports: c.supports === Number.MAX_SAFE_INTEGER ? quantity : c.supports,
        isLimiting: c.variantId === limitingVariantId,
      })),
    };
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function writeComponents(
  tx: TxClient,
  tenantId: string,
  bomId: string,
  components: { variantId: string; quantityPer: number; scrapPercent?: number; notes?: string }[]
): Promise<void> {
  for (const [index, c] of components.entries()) {
    await tx.bomComponent.create({
      data: {
        tenantId,
        bomId,
        variantId: c.variantId,
        quantityPer: c.quantityPer,
        scrapPercent: new Prisma.Decimal(c.scrapPercent ?? 0),
        position: index,
        notes: c.notes ?? null,
      },
    });
  }
}

async function assertVariantsExist(tx: TxClient, variantIds: string[]): Promise<void> {
  const unique = [...new Set(variantIds)];
  const found = await tx.productVariant.findMany({
    where: { id: { in: unique }, deletedAt: null },
    select: { id: true },
  });
  if (found.length !== unique.length) {
    throw new InventoryValidationError('One of those items does not exist.', [
      { field: 'components', message: 'unknown variant' },
    ]);
  }
}

/** A recipe that lists its own output as an ingredient would consume the thing
 *  it is making. Caught here rather than at completion, where it would have
 *  already written movements. */
function assertNoSelfReference(outputVariantId: string, componentIds: string[]): void {
  if (componentIds.includes(outputVariantId)) {
    throw new InventoryValidationError(
      'A recipe cannot list the thing it makes as one of its own ingredients.',
      [{ field: 'components', message: 'output listed as a component' }]
    );
  }
}

function assertNoDuplicateComponents(variantIds: string[]): void {
  const seen = new Set<string>();
  for (const id of variantIds) {
    if (seen.has(id)) {
      throw new InventoryValidationError(
        'The same item appears twice. Combine it into one line with the total quantity.',
        [{ field: 'components', message: `duplicate component ${id}` }]
      );
    }
    seen.add(id);
  }
}

async function loadBomDetail(tx: TxClient, id: string): Promise<BomDetail> {
  const bom = await tx.billOfMaterials.findFirst({ where: { id }, include: DETAIL_INCLUDE });
  if (!bom) throw new InventoryNotFoundError('BillOfMaterials', id);
  return serializeDetail(bom);
}

function serializeRow(bom: BomWithAll): BomRow {
  return {
    id: bom.id,
    outputVariantId: bom.outputVariantId,
    outputSku: bom.outputVariant?.sku ?? null,
    outputTitle: bom.outputVariant?.product?.title ?? null,
    name: bom.name,
    version: bom.version,
    status: bom.status as BomStatus,
    outputQuantity: bom.outputQuantity,
    laborCostCents: bom.laborCostCents,
    componentCount: bom.components.length,
    notes: bom.notes,
    createdAt: bom.createdAt.toISOString(),
    updatedAt: bom.updatedAt.toISOString(),
  };
}

function serializeDetail(bom: BomWithAll): BomDetail {
  const components = bom.components.map((c) => ({
    id: c.id,
    variantId: c.variantId,
    variantSku: c.variant?.sku ?? null,
    productTitle: c.variant?.product?.title ?? null,
    quantityPer: c.quantityPer,
    scrapPercent: Number(c.scrapPercent),
    quantityWithScrap: requiredForRun({
      quantityPerBatch: c.quantityPer,
      outputPerBatch: bom.outputQuantity,
      runQuantity: bom.outputQuantity,
      scrapPercent: Number(c.scrapPercent),
    }),
    position: c.position,
    notes: c.notes,
  }));

  return { ...serializeRow(bom), components, ...estimateCost(bom, components) };
}

/**
 * What one finished unit costs at TODAY's component costs.
 *
 * An estimate, and labelled as one everywhere it appears. The real figure is
 * settled when a run completes, from what genuinely left the shelf — which is
 * not the same number, because the shelf holds units bought at several prices.
 * The estimate is still worth having: it is what you price against before you
 * have made any.
 */
function estimateCost(
  bom: BomWithAll,
  components: { variantId: string; quantityWithScrap: number }[]
): { estimatedUnitCostCents: number; estimatedComponentCostCents: number } {
  const costByVariant = new Map(
    bom.components.map((c) => [c.variantId, c.variant?.costCents ?? 0])
  );
  // Scrap is IN the estimate, because scrap is a real cost. A recipe that wastes
  // 5% of an expensive part costs 5% more of it, and an estimate that quietly
  // excluded that would be the optimistic one every time.
  const componentCost = components.reduce(
    (sum, c) => sum + c.quantityWithScrap * (costByVariant.get(c.variantId) ?? 0),
    0
  );
  const total = componentCost + bom.laborCostCents;
  return {
    estimatedComponentCostCents: componentCost,
    estimatedUnitCostCents: Math.round(total / Math.max(1, bom.outputQuantity)),
  };
}

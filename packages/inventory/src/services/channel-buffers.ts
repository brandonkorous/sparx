// Per-channel oversell buffers (docs/146 Phase 1).
//
// `inventory_levels.safety_buffer` withholds N units from every channel equally.
// That is the wrong shape as soon as a tenant sells in more than one place. A
// storefront reads the level live and needs no cushion at all; a marketplace we
// push to on a fifteen-minute cycle needs several units of slack to survive the
// window between a sale landing here and the push landing there. Expressed as
// one number, the tenant has to pick between overselling the marketplace and
// hiding stock from their own site.
//
// Resolution order for a channel's sellable quantity:
//   1. an override row matching (channel, variant, warehouse)  — the surgical fix
//   2. a default row matching (channel), variant/warehouse null — the channel rule
//   3. `inventory_levels.safety_buffer`                         — the floor
//
// Step 3 is a FALLBACK, not a floor that adds: a channel that declares 0 really
// means 0, because the reason to declare it is usually "this channel is live and
// needs none of the cushion the slow ones do".
//
// Freshness interacts with this — a source in breach of its SLO under a
// `buffer_up` policy contributes an ADDITIONAL withhold on top of whatever this
// resolves to (see ./freshness.ts). That one does add, because it is a temporary
// penalty rather than a configured intent.

import { SetChannelBufferInput } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { InventoryNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';

// ─── Row shapes ────────────────────────────────────────────────────────────────

export interface ChannelBufferRow {
  id: string;
  channel: string;
  /** Null on a channel default; set on a level override. */
  variantId: string | null;
  variantSku: string | null;
  productTitle: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  warehouseCode: string | null;
  buffer: number;
  note: string | null;
  /** `default` (channel-wide) | `override` (one level). Derived, not stored — the
   *  distinction is what a reader needs and `variantId === null` is not obvious. */
  kind: 'default' | 'override';
  createdAt: string;
  updatedAt: string;
}

export interface ListChannelBuffersFilter {
  channel?: string;
  variantId?: string;
  warehouseId?: string;
  /** Only channel-wide defaults, or only level overrides. */
  kind?: 'default' | 'override';
  take?: number;
  skip?: number;
}

/** The resolved cushion for one (variant, warehouse) on one channel, and WHY it
 *  is that number. The reason string is not decoration — a buffer nobody can
 *  explain is a buffer nobody will trust or tune. */
export interface ResolvedChannelBuffer {
  channel: string;
  buffer: number;
  source: 'override' | 'channel_default' | 'level';
  /** The row that decided it, when a buffer row did. */
  bufferId: string | null;
}

// ─── Resolution ────────────────────────────────────────────────────────────────

/**
 * Resolve the buffer for ONE (variant, warehouse, channel) inside a transaction.
 *
 * Kept transaction-aware because the sell path calls it while holding the level
 * lock — a buffer read that opened its own connection there would see a level
 * the locking transaction has not committed yet, and the availability check
 * would be computed against two different points in time.
 */
export async function resolveChannelBufferOnTx(
  tx: TxClient,
  ctx: ServiceContext,
  input: {
    variantId: string;
    warehouseId: string;
    channel: string;
    /** The level's own `safety_buffer`, already read by the caller. Passed in
     *  rather than re-read: the caller holds the locked row and its value is the
     *  authoritative one for this decision. */
    levelSafetyBuffer: number;
  }
): Promise<ResolvedChannelBuffer> {
  // One query for both candidate rows — the override and the channel default
  // differ only by variant/warehouse being set, so `OR` fetches at most two rows
  // and the branch below picks. Two round trips for two rows is not worth it on
  // a path that runs inside a checkout's lock.
  const rows = await tx.inventoryChannelBuffer.findMany({
    where: {
      tenantId: ctx.tenantId,
      channel: input.channel,
      OR: [
        { variantId: input.variantId, warehouseId: input.warehouseId },
        { variantId: null, warehouseId: null },
      ],
    },
    select: { id: true, buffer: true, variantId: true },
  });

  return pickBuffer(input.channel, rows, input.levelSafetyBuffer);
}

/**
 * The resolution rule itself, with no database in it.
 *
 * Split out so the precedence can be tested directly. It is the kind of rule
 * that reads obviously correct and silently isn't — an override that loses to a
 * channel default, or a declared 0 that falls through to the level's cushion
 * because the code checked truthiness instead of existence, would both produce a
 * plausible number and quietly cost a merchant sales.
 */
export function pickBuffer(
  channel: string,
  rows: { id: string; buffer: number; variantId: string | null }[],
  levelSafetyBuffer: number
): ResolvedChannelBuffer {
  const override = rows.find((r) => r.variantId !== null);
  if (override) {
    return { channel, buffer: override.buffer, source: 'override', bufferId: override.id };
  }

  // `find`, not a truthiness check on the buffer: a channel that declares 0
  // MEANS 0 — usually "this one is live and needs none of the cushion the slow
  // ones do" — and falling through to the level's number would silently ignore
  // the most deliberate setting on the screen.
  const channelDefault = rows.find((r) => r.variantId === null);
  if (channelDefault) {
    return {
      channel,
      buffer: channelDefault.buffer,
      source: 'channel_default',
      bufferId: channelDefault.id,
    };
  }

  return { channel, buffer: levelSafetyBuffer, source: 'level', bufferId: null };
}

/** Public form — opens its own tenant transaction and reads the level itself.
 *  For explain-this-number reads, not the sell path. */
export async function resolveChannelBuffer(
  ctx: ServiceContext,
  input: { variantId: string; warehouseId: string; channel: string }
): Promise<ResolvedChannelBuffer> {
  return withTenant(ctx, async (tx) => {
    const level = await tx.inventoryLevel.findFirst({
      where: {
        tenantId: ctx.tenantId,
        variantId: input.variantId,
        warehouseId: input.warehouseId,
      },
      select: { safetyBuffer: true },
    });
    return resolveChannelBufferOnTx(tx, ctx, {
      ...input,
      levelSafetyBuffer: level?.safetyBuffer ?? 0,
    });
  });
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────

export async function listChannelBuffers(
  ctx: ServiceContext,
  filter: ListChannelBuffersFilter = {}
): Promise<{ items: ChannelBufferRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    // Explicit tenant scope as well as RLS: the local `sparx_owner` is a
    // SUPERUSER and bypasses RLS, so a broad scan would cross tenants in tests.
    const where = {
      tenantId: ctx.tenantId,
      ...(filter.channel ? { channel: filter.channel } : {}),
      ...(filter.variantId ? { variantId: filter.variantId } : {}),
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      ...(filter.kind === 'default' ? { variantId: null } : {}),
      ...(filter.kind === 'override' ? { variantId: { not: null } } : {}),
    };
    const include = {
      variant: { select: { sku: true, title: true, product: { select: { title: true } } } },
      warehouse: { select: { name: true, code: true } },
    };
    const [rows, total] = await Promise.all([
      tx.inventoryChannelBuffer.findMany({
        where,
        include,
        // Defaults first, then overrides — the channel rule is the thing a reader
        // needs to hold in their head before the exceptions to it make sense.
        orderBy: [{ channel: 'asc' }, { variantId: 'asc' }],
        take: Math.min(filter.take ?? 100, 500),
        skip: filter.skip ?? 0,
      }),
      tx.inventoryChannelBuffer.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        channel: r.channel,
        variantId: r.variantId,
        variantSku: r.variant?.sku ?? null,
        productTitle: r.variant?.product?.title ?? r.variant?.title ?? null,
        warehouseId: r.warehouseId,
        warehouseName: r.warehouse?.name ?? null,
        warehouseCode: r.warehouse?.code ?? null,
        buffer: r.buffer,
        note: r.note,
        kind: r.variantId === null ? ('default' as const) : ('override' as const),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      total,
    };
  });
}

/**
 * Create or update the buffer for a channel (default) or one level (override).
 *
 * Upsert rather than create+update because the caller thinks in terms of "this
 * channel withholds three", not "does a row exist yet". The two partial unique
 * indexes in the migration are what make the upsert safe against a concurrent
 * second setter.
 */
export async function setChannelBuffer(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<ChannelBufferRow> {
  const input = SetChannelBufferInput.parse(rawInput);

  const row = await withTenant(ctx, async (tx) => {
    if (input.variantId && input.warehouseId) {
      const variant = await tx.productVariant.findFirst({
        where: { id: input.variantId, deletedAt: null },
        select: { id: true },
      });
      if (!variant) throw new InventoryNotFoundError('Variant', input.variantId);
      const warehouse = await tx.warehouse.findFirst({
        where: { id: input.warehouseId, deletedAt: null },
        select: { id: true },
      });
      if (!warehouse) throw new InventoryNotFoundError('Warehouse', input.warehouseId);
    }

    const existing = await tx.inventoryChannelBuffer.findFirst({
      where: {
        tenantId: ctx.tenantId,
        channel: input.channel,
        variantId: input.variantId ?? null,
        warehouseId: input.warehouseId ?? null,
      },
      select: { id: true, buffer: true },
    });

    const saved = existing
      ? await tx.inventoryChannelBuffer.update({
          where: { id: existing.id },
          data: { buffer: input.buffer, note: input.note ?? null },
        })
      : await tx.inventoryChannelBuffer.create({
          data: {
            tenantId: ctx.tenantId,
            channel: input.channel,
            variantId: input.variantId ?? null,
            warehouseId: input.warehouseId ?? null,
            buffer: input.buffer,
            note: input.note ?? null,
          },
        });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: existing ? 'inventory.channel_buffer.updated' : 'inventory.channel_buffer.created',
      entityType: 'InventoryChannelBuffer',
      entityId: saved.id,
      diff: {
        before: existing ? { buffer: existing.buffer } : null,
        after: { channel: input.channel, buffer: input.buffer },
      },
    });

    return saved.id;
  });

  const { items } = await listChannelBuffers(ctx, { take: 1, channel: input.channel });
  const found = items.find((i) => i.id === row);
  if (found) return found;
  // The list read is a convenience for the enriched shape; if the row moved out
  // of the first page under a concurrent write, fall back to a direct read
  // rather than lying about what was saved.
  return withTenant(ctx, async (tx) => {
    const r = await tx.inventoryChannelBuffer.findFirstOrThrow({
      where: { id: row, tenantId: ctx.tenantId },
      include: {
        variant: { select: { sku: true, title: true, product: { select: { title: true } } } },
        warehouse: { select: { name: true, code: true } },
      },
    });
    return {
      id: r.id,
      channel: r.channel,
      variantId: r.variantId,
      variantSku: r.variant?.sku ?? null,
      productTitle: r.variant?.product?.title ?? r.variant?.title ?? null,
      warehouseId: r.warehouseId,
      warehouseName: r.warehouse?.name ?? null,
      warehouseCode: r.warehouse?.code ?? null,
      buffer: r.buffer,
      note: r.note,
      kind: r.variantId === null ? ('default' as const) : ('override' as const),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });
}

export async function deleteChannelBuffer(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.inventoryChannelBuffer.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, channel: true, buffer: true },
    });
    if (!existing) throw new InventoryNotFoundError('InventoryChannelBuffer', id);

    await tx.inventoryChannelBuffer.delete({ where: { id } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.channel_buffer.deleted',
      entityType: 'InventoryChannelBuffer',
      entityId: id,
      diff: { before: { channel: existing.channel, buffer: existing.buffer }, after: null },
    });
  });
}

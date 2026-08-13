// Preorder windows (docs/146 Phase 9.4) — selling something before it exists,
// on purpose and in writing.
//
// ── What was there before ────────────────────────────────────────────────────
//
// `inventoryPolicy = 'preorder'` has existed since the first commerce migration
// and has always been a pure synonym for `continue`: sell it, let on-hand go
// negative, say nothing. That is not a preorder. A preorder is a DELIBERATE,
// BOUNDED, DATED offer, and each of those three words is missing from a policy
// string:
//
//   deliberate  it opens and closes on dates the merchant chose
//   bounded     there is a number of units you are willing to owe
//   dated       the customer is told when to expect it
//
// ── The date ─────────────────────────────────────────────────────────────────
//
// `availableAt` is nullable, and keeping it nullable was the hardest call in the
// phase. Every instinct says a preorder must have a date — but a factory that
// has not committed to one is completely ordinary, and a merchant forced to fill
// the field will type something. That something goes onto the product page as a
// commitment, into the confirmation email, and into the customer's diary. So the
// window may say "date to be confirmed", which sells honestly, and
// `availabilityNote` carries the human version ("ships with the spring run").

import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';
import {
  preorderState,
  UpsertPreorderWindowInput,
  type PreorderState,
  type PreorderWindowShape,
} from '@sparx/commerce-schemas';

import { writeAuditLog } from '../audit';
import {
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryValidationError,
  type ServiceContext,
} from '../errors';

export interface PreorderWindowRow {
  id: string;
  variantId: string;
  variantSku: string | null;
  variantName: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  /** Null means NOBODY HAS SAID. Renders as "date to be confirmed", never as an
   *  estimate and never as an empty cell. */
  availableAt: string | null;
  availabilityNote: string | null;
  isCapped: boolean;
  maxQuantity: number;
  soldQuantity: number;
  /** Null when uncapped. A storefront must render null as nothing at all —
   *  there is no honest integer for "no limit". */
  remaining: number | null;
  isTakingOrders: boolean;
  effectiveStatus: string;
  blockedBy: string | null;
  chargeUpFront: boolean;
  note: string | null;
  createdAt: string;
}

interface WindowRecord {
  id: string;
  variantId: string;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  availableAt: Date | null;
  availabilityNote: string | null;
  isCapped: boolean;
  maxQuantity: number;
  soldQuantity: number;
  chargeUpFront: boolean;
  note: string | null;
  createdAt: Date;
  variant?: { sku: string | null; title: string | null } | null;
}

function serialize(w: WindowRecord, now: Date): PreorderWindowRow {
  const state: PreorderState = preorderState(
    {
      status: w.status as PreorderWindowShape['status'],
      startsAt: w.startsAt,
      endsAt: w.endsAt,
      isCapped: w.isCapped,
      maxQuantity: w.maxQuantity,
      soldQuantity: w.soldQuantity,
    },
    now
  );
  return {
    id: w.id,
    variantId: w.variantId,
    variantSku: w.variant?.sku ?? null,
    variantName: w.variant?.title ?? null,
    status: w.status,
    startsAt: w.startsAt?.toISOString() ?? null,
    endsAt: w.endsAt?.toISOString() ?? null,
    availableAt: w.availableAt?.toISOString() ?? null,
    availabilityNote: w.availabilityNote,
    isCapped: w.isCapped,
    maxQuantity: w.maxQuantity,
    soldQuantity: w.soldQuantity,
    remaining: state.remaining,
    isTakingOrders: state.isTakingOrders,
    effectiveStatus: state.effectiveStatus,
    blockedBy: state.blockedBy,
    chargeUpFront: w.chargeUpFront,
    note: w.note,
    createdAt: w.createdAt.toISOString(),
  };
}

const SELECT = {
  id: true,
  variantId: true,
  status: true,
  startsAt: true,
  endsAt: true,
  availableAt: true,
  availabilityNote: true,
  isCapped: true,
  maxQuantity: true,
  soldQuantity: true,
  chargeUpFront: true,
  note: true,
  createdAt: true,
  variant: { select: { sku: true, title: true } },
} as const;

export interface ListPreorderWindowsFilter {
  variantId?: string;
  status?: string;
  /** Only the ones a customer could actually buy from right now. */
  liveOnly?: boolean;
  take?: number;
  skip?: number;
}

export async function listPreorderWindows(
  ctx: ServiceContext,
  filter: ListPreorderWindowsFilter = {}
): Promise<{ items: PreorderWindowRow[]; total: number }> {
  const take = Math.min(Math.max(filter.take ?? 50, 1), 200);
  const skip = Math.max(filter.skip ?? 0, 0);

  return withTenant(ctx, async (tx) => {
    const where = {
      tenantId: ctx.tenantId,
      ...(filter.variantId ? { variantId: filter.variantId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.liveOnly ? { status: { in: ['scheduled', 'open'] } } : {}),
    };
    const [rows, total] = await Promise.all([
      tx.preorderWindow.findMany({
        where,
        orderBy: [{ status: 'asc' }, { availableAt: 'asc' }, { createdAt: 'desc' }],
        take,
        skip,
        select: SELECT,
      }),
      tx.preorderWindow.count({ where }),
    ]);
    const now = new Date();
    // `liveOnly` means what a CUSTOMER would call live, so the dates get the
    // final word — a window whose end passed an hour ago is stored as `open`
    // until the sweep catches up, and it must not be offered in the meantime.
    const items = rows.map((r) => serialize(r as WindowRecord, now));
    return {
      items: filter.liveOnly ? items.filter((i) => i.isTakingOrders) : items,
      total,
    };
  });
}

export async function getPreorderWindow(
  ctx: ServiceContext,
  id: string
): Promise<PreorderWindowRow> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.preorderWindow.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: SELECT,
    });
    if (!row) throw new InventoryNotFoundError('PreorderWindow', id);
    return serialize(row, new Date());
  });
}

/**
 * The live window for a variant, or null.
 *
 * This is what the storefront asks. It returns a row even when that row is not
 * currently taking orders — a scheduled window is worth showing ("opens on the
 * 3rd") and a sold-out one is worth showing too ("preorders closed"), because
 * both are better than a bare out-of-stock.
 */
export async function getLivePreorderWindow(
  ctx: ServiceContext,
  variantId: string
): Promise<PreorderWindowRow | null> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.preorderWindow.findFirst({
      where: { tenantId: ctx.tenantId, variantId, status: { in: ['scheduled', 'open'] } },
      select: SELECT,
    });
    return row ? serialize(row, new Date()) : null;
  });
}

export async function openPreorderWindow(
  ctx: ServiceContext,
  variantId: string,
  rawInput: unknown
): Promise<PreorderWindowRow> {
  const input = UpsertPreorderWindowInput.parse(rawInput);

  const id = await withTenant(ctx, async (tx) => {
    const variant = await tx.productVariant.findFirst({
      where: { id: variantId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true, inventoryPolicy: true },
    });
    if (!variant) throw new InventoryNotFoundError('ProductVariant', variantId);

    const existing = await tx.preorderWindow.findFirst({
      where: { tenantId: ctx.tenantId, variantId, status: { in: ['scheduled', 'open'] } },
      select: { id: true },
    });
    if (existing) {
      throw new InventoryConflictError(
        'This item already has a preorder running. Close it before opening another.',
        'variantId'
      );
    }

    // Opening a window on a `deny` variant would produce a page that offers a
    // preorder and a checkout that refuses it. Flipping the policy here is the
    // right move rather than an error: the merchant has unambiguously said they
    // want to sell this before it exists, and making them find a second switch
    // in a different screen to make their first switch work is the kind of thing
    // that gets called broken.
    if (variant.inventoryPolicy === 'deny') {
      await tx.productVariant.update({
        where: { id: variantId },
        data: { inventoryPolicy: 'preorder' },
      });
    }

    const row = await tx.preorderWindow.create({
      data: {
        tenantId: ctx.tenantId,
        variantId,
        status: input.startsAt && new Date(input.startsAt) > new Date() ? 'scheduled' : 'open',
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        availableAt: input.availableAt ? new Date(input.availableAt) : null,
        availabilityNote: input.availabilityNote ?? null,
        isCapped: input.isCapped ?? false,
        maxQuantity: input.maxQuantity ?? 0,
        chargeUpFront: input.chargeUpFront ?? true,
        note: input.note ?? null,
      },
      select: { id: true },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.preorder.opened',
      entityType: 'PreorderWindow',
      entityId: row.id,
      diff: {
        after: {
          variantId,
          availableAt: input.availableAt ?? null,
          isCapped: input.isCapped ?? false,
          maxQuantity: input.maxQuantity ?? 0,
        },
      },
    });

    return row.id;
  });

  return getPreorderWindow(ctx, id);
}

export async function updatePreorderWindow(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<PreorderWindowRow> {
  const input = UpsertPreorderWindowInput.parse(rawInput);

  await withTenant(ctx, async (tx) => {
    const existing = await tx.preorderWindow.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { status: true, soldQuantity: true },
    });
    if (!existing) throw new InventoryNotFoundError('PreorderWindow', id);
    if (existing.status === 'closed' || existing.status === 'cancelled') {
      throw new InventoryConflictError(`This preorder is already ${existing.status}.`, 'status');
    }

    // A cap cannot be lowered below what has already been sold. The units are
    // owed whatever the field says, and a screen reading "120 of 100 sold" is a
    // merchant discovering their own oversell from a rendering artefact.
    if (input.isCapped && (input.maxQuantity ?? 0) < existing.soldQuantity) {
      throw new InventoryValidationError(
        `${existing.soldQuantity} are already committed — the limit cannot go below that.`,
        [{ field: 'maxQuantity', message: `Must be at least ${existing.soldQuantity}.` }]
      );
    }

    await tx.preorderWindow.update({
      where: { id },
      data: {
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        availableAt: input.availableAt ? new Date(input.availableAt) : null,
        availabilityNote: input.availabilityNote ?? null,
        ...(input.isCapped !== undefined ? { isCapped: input.isCapped } : {}),
        ...(input.maxQuantity !== undefined ? { maxQuantity: input.maxQuantity } : {}),
        ...(input.chargeUpFront !== undefined ? { chargeUpFront: input.chargeUpFront } : {}),
        note: input.note ?? null,
      },
    });
  });

  return getPreorderWindow(ctx, id);
}

/** Stop taking preorders. The window and its history are kept — how many were
 *  committed and when is the thing a merchant looks at before running the next
 *  one. */
export async function closePreorderWindow(
  ctx: ServiceContext,
  id: string,
  status: 'closed' | 'cancelled' = 'closed'
): Promise<PreorderWindowRow> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.preorderWindow.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { status: true },
    });
    if (!existing) throw new InventoryNotFoundError('PreorderWindow', id);
    if (existing.status === status) return;
    await tx.preorderWindow.update({
      where: { id },
      data: { status, closedAt: new Date() },
    });
  });
  return getPreorderWindow(ctx, id);
}

/**
 * Take units off a live window as part of a sale, inside the caller's
 * transaction.
 *
 * Row-locked, and that lock is the whole reason this is a function rather than
 * an increment: a capped preorder is exactly the situation where two customers
 * race for the last unit, and an unlocked read-then-write hands it to both.
 *
 * Returns null when the variant has no live window — the overwhelmingly common
 * case, and not an error. An ordinary backorder is still an ordinary backorder.
 */
export async function consumePreorderOnTx(
  tx: TxClient,
  ctx: ServiceContext,
  params: { variantId: string; quantity: number }
): Promise<{ windowId: string; availableAt: Date | null } | null> {
  if (params.quantity <= 0) return null;

  const locked = await tx.$queryRaw<
    {
      id: string;
      isCapped: boolean;
      maxQuantity: number;
      soldQuantity: number;
      availableAt: Date | null;
      startsAt: Date | null;
      endsAt: Date | null;
      status: string;
    }[]
  >`
    SELECT id,
           is_capped     AS "isCapped",
           max_quantity  AS "maxQuantity",
           sold_quantity AS "soldQuantity",
           available_at  AS "availableAt",
           starts_at     AS "startsAt",
           ends_at       AS "endsAt",
           status
      FROM inventory_preorder_windows
     WHERE tenant_id  = ${ctx.tenantId}::uuid
       AND variant_id = ${params.variantId}::uuid
       AND status IN ('scheduled', 'open')
     FOR UPDATE
  `;
  const window = locked[0];
  if (!window) return null;

  const state = preorderState(
    {
      status: window.status as never,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      isCapped: window.isCapped,
      maxQuantity: window.maxQuantity,
      soldQuantity: window.soldQuantity,
    },
    new Date()
  );
  if (!state.isTakingOrders) {
    throw new InventoryConflictError(
      state.blockedBy === 'sold_out' ? 'This preorder has sold out.' : 'This preorder is not open.',
      'preorder'
    );
  }
  if (state.remaining !== null && params.quantity > state.remaining) {
    throw new InventoryConflictError(`Only ${state.remaining} left on this preorder.`, 'quantity');
  }

  await tx.preorderWindow.update({
    where: { id: window.id },
    data: { soldQuantity: { increment: params.quantity } },
  });

  return { windowId: window.id, availableAt: window.availableAt };
}

/**
 * Refuse a hold that would break a live preorder's cap — read-only, no lock.
 *
 * Called from `reserveOnTx`, which is the last moment a customer can be told no
 * without a refund being involved. Deliberately does NOT increment: a cart is
 * not a commitment, and counting carts against a limited run would let a dozen
 * abandoned baskets sell out a product.
 *
 * A variant with no live window passes silently. `inventoryPolicy = 'preorder'`
 * without a window is the pre-Phase-9 behaviour — an unbounded backorder — and
 * that stays exactly as it was for everyone already relying on it.
 */
export async function assertPreorderHeadroomOnTx(
  tx: TxClient,
  ctx: ServiceContext,
  params: { variantId: string; quantity: number }
): Promise<void> {
  if (params.quantity <= 0) return;

  const row = await tx.preorderWindow.findFirst({
    where: {
      tenantId: ctx.tenantId,
      variantId: params.variantId,
      status: { in: ['scheduled', 'open'] },
    },
    select: {
      status: true,
      startsAt: true,
      endsAt: true,
      isCapped: true,
      maxQuantity: true,
      soldQuantity: true,
    },
  });
  if (!row) return;

  const state = preorderState(
    {
      status: row.status as never,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      isCapped: row.isCapped,
      maxQuantity: row.maxQuantity,
      soldQuantity: row.soldQuantity,
    },
    new Date()
  );

  if (!state.isTakingOrders) {
    throw new InventoryConflictError(
      state.blockedBy === 'sold_out'
        ? 'This preorder has sold out.'
        : state.blockedBy === 'not_started'
          ? 'This preorder has not opened yet.'
          : 'This preorder has closed.',
      'preorder'
    );
  }
  if (state.remaining !== null && params.quantity > state.remaining) {
    throw new InventoryConflictError(`Only ${state.remaining} left on this preorder.`, 'quantity');
  }
}

export interface PreorderSweepResult {
  /** Windows whose stored status the dates had overtaken. */
  reconciled: number;
  /** Windows that opened tonight. */
  opened: number;
  /** Windows that ended. */
  closed: number;
}

/**
 * Bring the stored status back in line with the dates.
 *
 * The dates are authoritative on every read, so this changes no behaviour — it
 * exists so a LIST can filter on the column and so a merchant looking at the
 * screen sees the same word the storefront is acting on. A derived value that is
 * only ever computed at read time cannot be indexed, and one that is only ever
 * stored goes stale; keeping both, with the derived one winning, is the trade.
 */
export async function syncPreorderWindowStatuses(
  ctx: ServiceContext
): Promise<PreorderSweepResult> {
  return withTenant(ctx, async (tx) => {
    const now = new Date();
    const opened = await tx.preorderWindow.updateMany({
      where: {
        tenantId: ctx.tenantId,
        status: 'scheduled',
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      },
      data: { status: 'open' },
    });
    const closed = await tx.preorderWindow.updateMany({
      where: {
        tenantId: ctx.tenantId,
        status: { in: ['scheduled', 'open'] },
        endsAt: { lte: now },
      },
      data: { status: 'closed', closedAt: now },
    });
    return {
      reconciled: opened.count + closed.count,
      opened: opened.count,
      closed: closed.count,
    };
  });
}

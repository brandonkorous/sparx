// orderService — list / get / create / update / cancel.
//
// Payment, refund, and fulfillment subresources live in their own service
// files (order-payments-service.ts, order-refunds-service.ts,
// order-fulfillments-service.ts) so each file stays under the 200-line
// limit and the lifecycle invariants stay readable.
//
// Every state-changing function:
//   1. Validates input against the Zod schema in @wizeworks/crm-schemas
//   2. Wraps DB work in withTenant() (RLS context per transaction)
//   3. Writes an audit_logs row inside the same transaction
//   4. After the tx commits, publishes a PLATFORM event (`order.created`,
//      `order.cancelled`, etc.) that the CRM consumer picks up to record
//      the activity + update denormalized customer stats.

import crypto from 'node:crypto';

import {
  CancelOrderInput,
  CreateOrderInput,
  ListOrdersInput,
  UNCOUNTED_ORDER_STATUS,
  HELD_FOR_SIGN_OFF_STATUS,
  NOT_COLLECTABLE_ORDER_STATUSES,
  OWING_PAYMENT_STATUSES,
  UpdateOrderInput,
} from '@wizeworks/crm-schemas';
import { afterCommit, nameSearchClauses, withTenant } from '@wizeworks/db';
import type { Order, OrderItem, Prisma, TxClient } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { publishPlatformEvent } from '../consumers/platform-bus';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';
import { computeLine, computeTotals } from './order-totals';
import { resolveReadyOn } from './order-ready-on';
import { nextOrderNumber } from './record-numbers';
import { recomputeCustomerCommerce } from './customer-rollup';
import { closeWhenOrderMovesOn } from './task-service';

/** The customer summary joined onto both the list rows and a single order —
 *  enough to name the buyer and, when they belong to one, their B2B account and
 *  its terms. */
export interface OrderCustomerSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  companyId: string | null;
  /**
   * The wholesale business this order is for, attached AFTER the query.
   *
   * It used to be a plain `company: { select: … }` on the customer, and it came
   * back `null` on every order ever placed. `Customer.company` is a relation in
   * the schema AND a computed field on the Prisma client — `@wizeworks/db`'s
   * `withDerivedFields` publishes `company` as the customer's typed
   * `companyName` string, because that is the wire name 120 payloads already
   * use — and the computed one wins. MEASURED 2026-09-20:
   *
   *     company read directly    { companyName: 'Loom and Larder' }
   *     relation via customer    { companyId: '9b6d…', company: null }
   *     same join in raw SQL     [{ company_name: 'Loom and Larder' }]
   *
   * So the join was dead and silent, and the order detail's "Wholesale
   * customer: …" line has never rendered for anybody (issue 751).
   *
   * Under a name of its own it cannot be shadowed. One extra query per page of
   * orders, not one per row.
   */
  b2bAccount: {
    id: string;
    companyName: string;
    paymentTerms: string | null;
    status: string;
  } | null;
}

const ORDER_CUSTOMER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  companyName: true,
  email: true,
  companyId: true,
  // NOTE: no `company: { select: … }` here. It looks right, it typechecks, and
  // it comes back null on every row — see `b2bAccount` above. `check:shadowed`
  // fails the build if anybody adds it back.
} as const;

/** The businesses behind a page of orders, in one query, keyed by id.
 *
 *  `paymentTerms` rides along so the B2B lens can show what an order is owed
 *  under without a second trip. */
async function accountsFor(
  tx: TxClient,
  rows: { customer: { companyId: string | null } | null }[]
): Promise<Map<string, OrderCustomerSummary['b2bAccount']>> {
  const ids = [
    ...new Set(
      rows
        .map((r) => r.customer?.companyId)
        .filter((id): id is string => id !== null && id !== undefined)
    ),
  ];
  if (ids.length === 0) return new Map();
  const accounts = await tx.company.findMany({
    where: { id: { in: ids } },
    select: { id: true, companyName: true, paymentTerms: true, status: true },
  });
  return new Map(accounts.map((a) => [a.id, a]));
}

/** The customer exactly as `ORDER_CUSTOMER_SELECT` fetches it — before its
 *  business is put back on. */
type PlainOrderCustomer = Omit<OrderCustomerSummary, 'b2bAccount'>;

/** Put each row's business on its customer, or null when it has none. */
function withAccounts<T extends { customer: PlainOrderCustomer | null }>(
  rows: T[],
  accounts: Map<string, OrderCustomerSummary['b2bAccount']>
): (Omit<T, 'customer'> & { customer: OrderCustomerSummary })[] {
  return rows.map((row) => ({
    ...row,
    customer: {
      ...row.customer,
      b2bAccount: (row.customer?.companyId ? accounts.get(row.customer.companyId) : null) ?? null,
    } as OrderCustomerSummary,
  }));
}

/** One order, with its business attached. Used by every write path that hands
 *  a whole order back, so a freshly written order reads the same as a fetched
 *  one — a shape that differs by which door you came through is the next
 *  version of issue 751. */
async function oneWithAccount<T extends { customer: PlainOrderCustomer | null }>(
  tx: TxClient,
  row: T
): Promise<Omit<T, 'customer'> & { customer: OrderCustomerSummary }> {
  const [only] = withAccounts([row], await accountsFor(tx, [row]));
  return only as Omit<T, 'customer'> & { customer: OrderCustomerSummary };
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
  customer: OrderCustomerSummary;
  /** Of `refundTotal`, how much went back as returned core deposits. Set by
   *  `get`; a write path hands its order back without it. */
  depositsReturned?: number;
}

/** A list row carries just enough of the customer (and, for a customer who
 *  belongs to one, their B2B account) to render the Customer / Account columns
 *  without an N+1 per row. Additive over `Order`, so existing consumers that
 *  only read order fields are unaffected. */
export interface OrderListRow extends Order {
  customer: OrderCustomerSummary;
  /** Of `refundTotal`, how much went back as returned core deposits. */
  depositsReturned: number;
}

/**
 * How much of each order's refunds went back as core deposits, in one query.
 *
 * A rebuilt part's deposit coming back when the old part does is the HAPPY end of
 * the sale, and it is recorded as a refund. Read from `refundTotal` alone it looks
 * like any other money returned, so every one of Gillett Diesel's finished
 * rebuilt-part orders showed an amber "Part refunded" (sparx persona issue 057).
 * The refund records which kind it was; this reads it.
 */
async function depositsReturnedFor(tx: TxClient, orderIds: string[]): Promise<Map<string, number>> {
  if (orderIds.length === 0) return new Map();
  const rows = await tx.orderRefund.groupBy({
    by: ['orderId'],
    where: {
      orderId: { in: orderIds },
      status: 'completed',
      metadata: { path: ['kind'], equals: 'core' },
    },
    _sum: { amount: true },
  });
  return new Map(rows.map((row) => [row.orderId, Number(row._sum.amount ?? 0)]));
}

/**
 * "There is still money to collect on this order", as a query.
 *
 * The one place this question is asked in SQL. It used to be asked as
 * `paymentStatus: 'unpaid'`, which is a column value and not the question: a
 * cancelled order carries 'unpaid' for the rest of its life, and a part-paid one
 * does not carry it at all. The rule and the reasoning live in
 * `isOwingOrder` — this is the same rule in the shape a `where` needs, so the
 * two cannot drift.
 */
export const OWING_ORDER_WHERE: Prisma.OrderWhereInput = {
  status: { notIn: [...NOT_COLLECTABLE_ORDER_STATUSES, HELD_FOR_SIGN_OFF_STATUS] },
  paymentStatus: { in: [...OWING_PAYMENT_STATUSES] },
};

// ─────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────

export async function list(
  ctx: ServiceContext,
  rawFilter: unknown = {}
): Promise<{ items: OrderListRow[]; total: number }> {
  const filter = ListOrdersInput.parse(rawFilter);
  return withTenant(ctx, async (tx) => {
    const where: Prisma.OrderWhereInput = {
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      // An explicit status wins: asking for cancelled orders and getting none
      // would be the worse surprise.
      ...(filter.countedOnly && !filter.status ? { status: { not: UNCOUNTED_ORDER_STATUS } } : {}),
      ...(filter.paymentStatus ? { paymentStatus: filter.paymentStatus } : {}),
      ...(filter.channel ? { channel: filter.channel } : {}),
      ...(filter.propertyId ? { propertyId: filter.propertyId } : {}),
      // Member access ceiling (docs/131 §3.3): a restricted member sees only
      // orders on their granted sites — NOT null-property (orphaned) orders,
      // which belong to a deleted business they have no claim to.
      ...(filter.propertyIds ? { propertyId: { in: filter.propertyIds } } : {}),
      // B2B scoping rides the customer relation — an Order carries no
      // companyId of its own. A specific account wins over the broad
      // "any B2B account" lens when both are supplied.
      ...(filter.companyId
        ? { customer: { companyId: filter.companyId } }
        : filter.b2bOnly
          ? { customer: { companyId: { not: null } } }
          : {}),
      ...(filter.placedSince || filter.placedUntil
        ? {
            placedAt: {
              ...(filter.placedSince ? { gte: new Date(filter.placedSince) } : {}),
              ...(filter.placedUntil ? { lte: new Date(filter.placedUntil) } : {}),
            },
          }
        : {}),
      // Search spans the order number AND the buyer. It was an order-number
      // PREFIX match, which answers only the question someone already knows the
      // answer to — a customer on the phone gives you their name, not
      // "ORD-1042", and a partial number ("1042") matched nothing at all.
      //
      // Then it still could not find them by that name, because it asked
      // whether the WHOLE typed string was inside one column: "Jo Kim" is not
      // inside "Jo" and not inside "Kim", so a box labelled "Order number or
      // customer…" answered "No orders match that" over two of her orders.
      // AND rather than a spread of its two keys, because a spread would
      // OVERWRITE `status` above — so `?status=placed&owing=true` would quietly
      // drop the status and answer a wider question than it was asked. As a
      // conjunct it composes: "placed AND still owed" is a real question, and one
      // the chips cannot ask because they are a single-select row.
      AND: [
        ...nameSearchClauses(filter.q, (term) => [
          { orderNumber: { contains: term, mode: 'insensitive' as const } },
          { customer: { firstName: { contains: term, mode: 'insensitive' as const } } },
          { customer: { lastName: { contains: term, mode: 'insensitive' as const } } },
          { customer: { companyName: { contains: term, mode: 'insensitive' as const } } },
          { customer: { email: { contains: term, mode: 'insensitive' as const } } },
        ]),
        ...(filter.owing ? [OWING_ORDER_WHERE] : []),
      ],
    };
    const [items, total] = await Promise.all([
      tx.order.findMany({
        where,
        orderBy: { [filter.sortBy]: filter.order },
        take: filter.take,
        skip: filter.skip,
        // Joined so the Customer / Account columns render from the list query
        // itself — the alternative is a lookup per row. `select` rather than a
        // bare include: an order list has no business shipping the customer's
        // full record (addresses, notes, marketing state) to the browser.
        include: { customer: { select: ORDER_CUSTOMER_SELECT } },
      }),
      tx.order.count({ where }),
    ]);
    // One more query for the whole page, never one per row (two: the deposits).
    const [accounts, deposits] = await Promise.all([
      accountsFor(tx, items),
      depositsReturnedFor(
        tx,
        items.map((item) => item.id)
      ),
    ]);
    return {
      items: withAccounts(items, accounts).map((row) => ({
        ...row,
        depositsReturned: deposits.get(row.id) ?? 0,
      })),
      total,
    };
  });
}

export async function get(ctx: ServiceContext, orderId: string): Promise<OrderWithItems> {
  // The customer is joined here rather than fetched separately by the caller:
  // /v1/crm/customers is CRM-gated, so a commerce-only or B2B-only tenant could
  // not resolve the buyer's name on their own order at all. Joining it makes the
  // order detail self-sufficient across all three order lenses.
  const order = await withTenant(ctx, async (tx) => {
    const found = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, customer: { select: ORDER_CUSTOMER_SELECT } },
    });
    if (!found) return null;
    const [withAccount, deposits] = await Promise.all([
      oneWithAccount(tx, found),
      depositsReturnedFor(tx, [found.id]),
    ]);
    return { ...withAccount, depositsReturned: deposits.get(found.id) ?? 0 };
  });
  if (!order) throw new CrmNotFoundError('Order', orderId);
  return order;
}

// ─────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────

/** How a caller that is not the checkout controls the placement announcement.
 *
 *  `announce: false` is for a caller that must decide for itself WHEN the order
 *  becomes real to the rest of the platform. There is exactly one: the storefront
 *  checkout, which holds a wholesale order back for sign-off and publishes
 *  `b2b.order.pending_approval` in its place. Everything else — the till, an
 *  order typed in over the phone, a repeat order coming round again, any caller
 *  of `POST /v1/orders` — is real the moment it is written, and announcing it is
 *  this function's job rather than each caller's. */
export interface CreateOrderOptions {
  announce?: boolean;
}

export async function create(
  ctx: ServiceContext,
  rawInput: unknown,
  options: CreateOrderOptions = {}
): Promise<OrderWithItems> {
  const input = CreateOrderInput.parse(rawInput);
  const totals = computeTotals(
    input.items,
    input.shippingTotal,
    input.taxTotal,
    input.surchargeTotal,
    input.discountTotal
  );
  const placedAt = input.placedAt ? new Date(input.placedAt) : new Date();

  const order = await withTenant(ctx, async (tx) => {
    // Customer must exist + belong to this tenant (RLS enforces; explicit
    // check yields a clean NOT_FOUND instead of an FK violation).
    const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
    if (customer?.deletedAt !== null) {
      throw new CrmNotFoundError('Customer', input.customerId);
    }

    const orderNumber = input.orderNumber ?? (await nextOrderNumber(tx, ctx.tenantId));

    // The day this can be handed over (issue 026) — the placed day plus the
    // longest notice anything on it needs, counted in the BUSINESS's own zone.
    // An order placed at 11:30pm in Denver is already tomorrow in UTC, and five
    // days from the wrong one is a Sunday nobody agreed to. Frozen here: a shop
    // that lengthens a cake's notice next month must not move a date somebody
    // was already promised.
    const readyOn = await resolveReadyOn(tx, placedAt, input.orderAheadDays ?? null);

    const created = await tx.order.create({
      data: {
        tenantId: ctx.tenantId,
        customerId: input.customerId,
        orderNumber,
        propertyId: input.propertyId ?? null,
        channel: input.channel ?? null,
        source: input.source ?? null,
        currency: input.currency,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        shippingTotal: totals.shippingTotal,
        discountTotal: totals.discountTotal,
        surchargeTotal: totals.surchargeTotal,
        appliedSurcharges: (input.appliedSurcharges ?? []) as Prisma.InputJsonValue,
        coreChargeTotal: totals.coreChargeTotal,
        total: totals.total,
        shippingAddress: (input.shippingAddress ?? null) as Prisma.InputJsonValue,
        billingAddress: (input.billingAddress ?? null) as Prisma.InputJsonValue,
        placedAt,
        readyOn,
        customerNote: input.customerNote ?? null,
        internalNote: input.internalNote ?? null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        items: {
          create: input.items.map((item) => {
            const line = computeLine(item);
            return {
              tenantId: ctx.tenantId,
              productId: item.productId ?? null,
              variantId: item.variantId ?? null,
              sku: item.sku,
              name: item.name,
              description: item.description ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineSubtotal: line.lineSubtotal,
              taxAmount: line.taxAmount,
              discountAmount: line.discountAmount,
              lineTotal: line.lineTotal,
              coreCharge: item.coreCharge ?? null,
              coreFirst: item.coreFirst === true,
              metadata: (item.metadata ?? {}) as Prisma.InputJsonValue,
            };
          }),
        },
      },
      // Same customer join as get()/list() — a created order is returned
      // straight to the caller, which renders it through an order lens that
      // expects the buyer to be present.
      include: { items: true, customer: { select: ORDER_CUSTOMER_SELECT } },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.order.created',
      entityType: 'Order',
      entityId: created.id,
      diff: {
        after: { orderNumber: created.orderNumber, total: created.total.toString() },
      },
    });

    // The buyer's figures, in the same transaction as the order. They used to be
    // an increment applied by a consumer, which is how three of five orders on
    // one shop never reached the buyer at all — see customer-rollup.ts.
    await recomputeCustomerCommerce(tx, ctx.tenantId, created.customerId);

    return oneWithAccount(tx, created);
  });

  // Upstream platform event — the order-event consumer picks this up and writes
  // the matching CrmActivity; the scoring and segment evaluators re-derive the
  // buyer from it.
  //
  // AFTER THE COMMIT, not after this function's own withTenant. Checkout
  // composes this call into ITS transaction (`{ ...ctx, tx }`), and there the
  // withTenant above returns with the order still uncommitted — so every
  // consumer ran against a database the order was not in yet. See after-commit.
  //
  // `orderNumber` travels in the payload for the same reason. The consumer used
  // to read it back out of the database to name the order in a sentence, which
  // is a lookup that can only fail, and did: four of five orders on one shop
  // said "An order was placed" and named none of them (issue 307). What the
  // producer already holds should not be fetched again by the reader.
  await afterCommit('publish order.created', () =>
    publishPlatformEvent({
      id: crypto.randomUUID(),
      topic: 'order.created',
      tenantId: ctx.tenantId,
      occurredAt: placedAt,
      payload: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        total: Number(order.total),
        currency: order.currency,
        placedAt: placedAt.toISOString(),
      },
    })
  );

  // …and `order.placed`, which is the one the REST of the platform listens to.
  //
  // `order.created` above is this package's own in-process signal, and only
  // that: the CRM consumer reads it to write the timeline row and the customer
  // stats. It is NOT in the event catalog (wizeworks/packages/events/src/types.ts
  // lists order.placed / paid / fulfilled / delivered / cancelled / refunded,
  // and CLAUDE.md says in as many words that there is no `order.created`), so
  // nothing outside this process can subscribe it. `order.placed` is the
  // catalog topic the search indexer, the dropship router and every automation
  // keyed on "a new order" read.
  //
  // Until now the ONLY publisher of it was `checkout-service`, so an order made
  // any other way was announced to nobody. MEASURED 2026-09-20 against the
  // running database, for one shop: 18 orders, 16 of them in the search index.
  // The two missing were the two most recent — one typed in at the till, one
  // raised by a repeat order coming round — and searching either order number
  // in the console answered with the numbers either side of it and not the one
  // she asked for, while the order itself sat open in the next pane.
  // [[feedback_a_fix_leaves_its_neighbour_behind]]
  //
  // The payload matches checkout's so the consumers cannot tell which caller
  // wrote the order, which is the point: an order is an order.
  if (options.announce !== false) {
    await afterCommit('publish order.placed', () =>
      publishPlatformEvent({
        id: crypto.randomUUID(),
        topic: 'order.placed',
        tenantId: ctx.tenantId,
        occurredAt: placedAt,
        payload: { orderId: order.id, orderNumber: order.orderNumber },
      })
    );
  }

  return order;
}

export async function update(
  ctx: ServiceContext,
  orderId: string,
  rawInput: unknown
): Promise<Order> {
  const input = UpdateOrderInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const before = await tx.order.findUnique({ where: { id: orderId } });
    if (!before) throw new CrmNotFoundError('Order', orderId);

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        ...(input.customerNote !== undefined ? { customerNote: input.customerNote } : {}),
        ...(input.internalNote !== undefined ? { internalNote: input.internalNote } : {}),
        ...(input.shippingAddress !== undefined
          ? { shippingAddress: input.shippingAddress as Prisma.InputJsonValue }
          : {}),
        ...(input.billingAddress !== undefined
          ? { billingAddress: input.billingAddress as Prisma.InputJsonValue }
          : {}),
        ...(input.metadata !== undefined
          ? { metadata: input.metadata as Prisma.InputJsonValue }
          : {}),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.order.updated',
      entityType: 'Order',
      entityId: updated.id,
      diff: null,
    });
    return updated;
  });
}

export async function cancel(ctx: ServiceContext, rawInput: unknown): Promise<Order> {
  const input = CancelOrderInput.parse(rawInput);
  const order = await withTenant(ctx, async (tx) => {
    const before = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!before) throw new CrmNotFoundError('Order', input.orderId);
    if (before.status === 'cancelled') return before;
    if (before.status === 'delivered' || before.status === 'refunded') {
      throw new CrmValidationError(`Cannot cancel an order in status "${before.status}"`);
    }
    const now = new Date();
    const updated = await tx.order.update({
      where: { id: input.orderId },
      data: { status: 'cancelled', cancelledAt: now, cancelledReason: input.reason ?? null },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.order.cancelled',
      entityType: 'Order',
      entityId: updated.id,
      diff: { before: { status: before.status }, after: { status: updated.status } },
    });
    // A cancelled order stops counting. Nothing did this before, so a cancelled
    // sale went on contributing to the buyer's lifetime spend and order count for
    // ever — the increment had already been applied and nothing took it back.
    await recomputeCustomerCommerce(tx, ctx.tenantId, updated.customerId);
    // A task waiting on the order to leave the status it was in has nothing left
    // to wait for: "waiting for your sign-off" on an order that no longer exists
    // to sign is false. Closed, not done, because nobody did what it asked.
    const by = ctx.userId
      ? await tx.user.findUnique({ where: { id: ctx.userId }, select: { name: true, email: true } })
      : null;
    // A blank name is no name: fall back to the email, as the trail does.
    const named = by?.name?.trim();
    const who = named !== undefined && named.length > 0 ? named : (by?.email ?? null);
    await closeWhenOrderMovesOn(tx, ctx, {
      orderId: updated.id,
      left: before.status,
      as: 'cancelled',
      because: `Order ${updated.orderNumber} was canceled${who ? ` by ${who}` : ''}, so there is nothing left to do here.`,
      byUserId: ctx.userId ?? null,
    });
    return updated;
  });

  await afterCommit('publish order.canceled', () =>
    publishPlatformEvent({
      id: crypto.randomUUID(),
      topic: 'order.cancelled',
      tenantId: ctx.tenantId,
      occurredAt: order.cancelledAt ?? new Date(),
      payload: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        reason: input.reason,
      },
    })
  );
  return order;
}

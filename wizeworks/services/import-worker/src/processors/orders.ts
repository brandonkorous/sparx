// Order history.
//
// The single most consequential design decision in this whole package lives here:
// **an imported order is WRITTEN, not PLACED.**
//
// Routing historical orders through the normal order service would run them as if
// they were happening now — decrementing the stock we just imported, firing
// `order.placed` into the event bus, sending the customer a confirmation email for a
// purchase they made in 2023, recomputing pricing against today's price list, and
// counting three years of revenue as today's. Every one of those is wrong, and two of
// them (the emails and the stock) are wrong in ways the tenant cannot undo.
//
// So the rows are written directly, with `channel: 'import'` — a value the Order model
// already anticipates — and `externalId` carrying the old platform's order number so a
// re-run updates rather than duplicates. No events, no stock movement, no email.
//
// The customer is created if they are not here yet, because an order with no customer
// is a row nobody can find. That is the one write this processor makes beyond the
// order itself, and it is reported.

import { customerService } from '@wizeworks/crm';
import { withTenant, type Prisma } from '@wizeworks/db';
import { toDecimal, toInteger, toIsoDate } from '@wizeworks/migration';

import { Resolver } from './resolve';
import type { EntityProcessor, ImportRow, PreviewResult, RowResult } from './types';

/** One order, gathered from the run of rows that share its number. */
interface Gathered {
  orderNumber: string;
  firstRowIndex: number;
  rowIndexes: number[];
  head: ImportRow;
  lines: ImportRow[];
}

/** Rows arrive flattened — one row per line item, order fields only on the first.
 *  Regrouping them is the inverse of what the vendor adapters did. */
function gather(rows: ImportRow[]): Gathered[] {
  const byNumber = new Map<string, Gathered>();
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]!;
    const orderNumber = (row.order_number ?? '').trim();
    if (orderNumber === '') continue;
    const existing = byNumber.get(orderNumber);
    if (existing === undefined) {
      byNumber.set(orderNumber, {
        orderNumber,
        firstRowIndex: index,
        rowIndexes: [index],
        head: row,
        lines: [row],
      });
    } else {
      existing.rowIndexes.push(index);
      existing.lines.push(row);
    }
  }
  return [...byNumber.values()];
}

/** Every platform's payment vocabulary, reduced to ours. */
function paymentStatusOf(value: string | undefined): string {
  const text = (value ?? '').trim().toLowerCase();
  if (['paid', 'captured', 'complete', 'completed', 'processing'].includes(text)) return 'paid';
  if (['partially_paid', 'partially paid', 'authorized'].includes(text)) return 'partially_paid';
  if (['refunded', 'partially_refunded', 'partially refunded'].includes(text)) return 'refunded';
  return 'unpaid';
}

function statusOf(row: ImportRow): string {
  const fulfilment = (row.fulfillment_status ?? '').trim().toLowerCase();
  const financial = (row.financial_status ?? '').trim().toLowerCase();
  if (financial === 'refunded') return 'refunded';
  if (['cancelled', 'canceled', 'voided'].includes(financial) || fulfilment === 'cancelled')
    return 'cancelled';
  if (['fulfilled', 'shipped', 'complete', 'completed', 'delivered'].includes(fulfilment))
    return fulfilment === 'delivered' ? 'delivered' : 'fulfilled';
  return 'placed';
}

function addressOf(row: ImportRow): Prisma.InputJsonValue | undefined {
  const line1 = (row.ship_address1 ?? '').trim();
  if (line1 === '') return undefined;
  return {
    recipientName: row.ship_name ?? row.customer_name ?? '',
    line1,
    line2: row.ship_address2 ?? '',
    city: row.ship_city ?? '',
    region: row.ship_province ?? '',
    postalCode: row.ship_zip ?? '',
    country: (row.ship_country ?? '').slice(0, 2).toUpperCase() || 'US',
  };
}

function decimal(value: string | undefined, fallback = 0): number {
  return toDecimal(value) ?? fallback;
}

export const ordersProcessor: EntityProcessor = {
  entity: 'orders',
  module: 'commerce',

  async run(ctx, rows, options, logger) {
    const resolver = new Resolver(ctx);
    const groups = gather(rows);
    const results: RowResult[] = [];

    // Rows that carried no order number at all are reported where they sit, rather
    // than vanishing between the grouping and the writing.
    const claimed = new Set(groups.flatMap((group) => group.rowIndexes));
    for (let index = 0; index < rows.length; index++) {
      if (!claimed.has(index)) {
        results.push({
          rowIndex: index,
          status: 'error',
          errorMsg: 'This row has no order number.',
        });
      }
    }

    for (const group of groups) {
      const { head, orderNumber, firstRowIndex } = group;
      try {
        const existing = await withTenant(ctx, (tx) =>
          tx.order.findFirst({
            where: {
              tenantId: ctx.tenantId,
              OR: [{ orderNumber }, { channel: 'import', externalId: orderNumber }],
            },
            select: { id: true },
          })
        );

        if (existing !== null && !options.upsert) {
          for (const rowIndex of group.rowIndexes) {
            results.push({ rowIndex, status: 'skipped', naturalKey: orderNumber });
          }
          continue;
        }

        // The customer. Created when unknown, because `Order.customerId` is required
        // and an order attached to nobody is unreachable from every screen that
        // matters.
        const email = (head.email ?? '').trim();
        let customerId = email === '' ? null : await resolver.customerByEmail(email);
        let createdCustomer = false;
        if (customerId === null) {
          const name = (head.customer_name ?? head.ship_name ?? '').trim();
          const [first = '', ...rest] = name.split(' ');
          const created = await customerService.create(ctx, {
            ...(email === '' ? {} : { email }),
            ...(first === '' ? {} : { firstName: first }),
            ...(rest.length === 0 ? {} : { lastName: rest.join(' ') }),
            ...(head.phone !== undefined && head.phone !== '' ? { phone: head.phone } : {}),
            ...(ctx.propertyId != null ? { propertyId: ctx.propertyId } : {}),
            lifecycleStage: 'customer' as const,
          });
          customerId = created.id;
          createdCustomer = true;
          if (email !== '') resolver.rememberCustomer(email, created.id);
        }

        const placedAt = toIsoDate(head.placed_at) ?? new Date().toISOString();
        const currency = /^[A-Za-z]{3}$/.test(head.currency ?? '')
          ? head.currency!.toUpperCase()
          : 'USD';
        const status = statusOf(head);
        const paymentStatus = paymentStatusOf(head.financial_status);

        const lines = group.lines.filter(
          (line) => (line.line_title ?? '').trim() !== '' || (line.line_sku ?? '').trim() !== ''
        );

        const itemData = await Promise.all(
          lines.map(async (line) => {
            const sku = (line.line_sku ?? '').trim();
            const variant = sku === '' ? null : await resolver.variantBySku(sku);
            const quantity = toInteger(line.line_quantity) ?? 1;
            const unitPrice = decimal(line.line_price);
            return {
              tenantId: ctx.tenantId,
              ...(variant === null ? {} : { variantId: variant.id, productId: variant.productId }),
              sku: (sku === '' ? 'imported' : sku).slice(0, 127),
              name: ((line.line_title ?? '').trim() || 'Imported item').slice(0, 255),
              quantity,
              unitPrice,
              lineSubtotal: unitPrice * quantity,
              lineTotal: unitPrice * quantity,
            };
          })
        );

        const subtotal = decimal(
          head.subtotal,
          itemData.reduce((sum, item) => sum + item.lineSubtotal, 0)
        );
        const total = decimal(head.total, subtotal);
        const shippingAddress = addressOf(head);

        const data = {
          tenantId: ctx.tenantId,
          customerId,
          ...(ctx.propertyId != null ? { propertyId: ctx.propertyId } : {}),
          orderNumber: orderNumber.slice(0, 63),
          status,
          paymentStatus,
          // The marker that keeps this out of every "what happened today" report and
          // makes a re-run an update rather than a duplicate.
          channel: 'import',
          ...(options.vendor === undefined ? {} : { source: options.vendor.slice(0, 63) }),
          externalId: orderNumber.slice(0, 255),
          ...(head.financial_status === undefined
            ? {}
            : { externalStatus: head.financial_status.slice(0, 50) }),
          subtotal,
          taxTotal: decimal(head.tax),
          shippingTotal: decimal(head.shipping),
          discountTotal: decimal(head.discount),
          total,
          amountPaid: paymentStatus === 'paid' ? total : 0,
          currency,
          ...(shippingAddress === undefined ? {} : { shippingAddress }),
          placedAt: new Date(placedAt),
          ...(paymentStatus === 'paid' ? { paidAt: new Date(placedAt) } : {}),
          ...(status === 'fulfilled' || status === 'delivered'
            ? { fulfilledAt: new Date(placedAt) }
            : {}),
          ...(head.note === undefined || head.note === '' ? {} : { customerNote: head.note }),
          metadata: {
            importedFrom: options.vendor ?? 'a file',
            importedAt: new Date().toISOString(),
            ...(head.discount_code === undefined ? {} : { discountCode: head.discount_code }),
            ...(head.shipping_method === undefined ? {} : { shippingMethod: head.shipping_method }),
          },
        };

        await withTenant(ctx, async (tx) => {
          if (existing !== null) {
            await tx.order.update({ where: { id: existing.id }, data });
            await tx.orderItem.deleteMany({ where: { orderId: existing.id } });
            if (itemData.length > 0) {
              await tx.orderItem.createMany({
                data: itemData.map((item) => ({ ...item, orderId: existing.id })),
              });
            }
            return;
          }
          const created = await tx.order.create({ data, select: { id: true } });
          if (itemData.length > 0) {
            await tx.orderItem.createMany({
              data: itemData.map((item) => ({ ...item, orderId: created.id })),
            });
          }
        });

        results.push({
          rowIndex: firstRowIndex,
          status: existing === null ? 'imported' : 'updated',
          naturalKey: orderNumber,
          ...(createdCustomer
            ? { errorMsg: `Also created the customer this order belongs to.` }
            : {}),
        });
        for (const rowIndex of group.rowIndexes.slice(1)) {
          results.push({ rowIndex, status: 'skipped', naturalKey: orderNumber });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn({ err: error, orderNumber }, 'order import failed');
        for (const rowIndex of group.rowIndexes) {
          results.push({ rowIndex, status: 'error', naturalKey: orderNumber, errorMsg: message });
        }
      }
    }

    return results.sort((a, b) => a.rowIndex - b.rowIndex);
  },

  async preview(ctx, rows, logger) {
    const groups = gather(rows);
    const results: PreviewResult[] = [];

    const claimed = new Set(groups.flatMap((group) => group.rowIndexes));
    for (let index = 0; index < rows.length; index++) {
      if (!claimed.has(index)) {
        results.push({ rowIndex: index, action: 'error', errorMsg: 'No order number.' });
      }
    }

    for (const group of groups) {
      // One decision per ORDER, then the continuation rows are marked as belonging to
      // it — a five-line order is one thing happening, not five.
      let action: PreviewResult['action'];
      let errorMsg: string | undefined;
      try {
        const existing = await withTenant(ctx, (tx) =>
          tx.order.findFirst({
            where: {
              tenantId: ctx.tenantId,
              OR: [
                { orderNumber: group.orderNumber },
                { channel: 'import', externalId: group.orderNumber },
              ],
            },
            select: { id: true },
          })
        );
        action = existing === null ? 'create' : 'update';
      } catch (error) {
        logger.warn({ err: error, orderNumber: group.orderNumber }, 'order preview failed');
        action = 'error';
        errorMsg = error instanceof Error ? error.message : String(error);
      }

      results.push({
        rowIndex: group.firstRowIndex,
        action,
        naturalKey: group.orderNumber,
        ...(errorMsg === undefined ? {} : { errorMsg }),
      });
      for (const rowIndex of group.rowIndexes.slice(1)) {
        results.push({ rowIndex, action: 'skip', naturalKey: group.orderNumber });
      }
    }

    return results.sort((a, b) => a.rowIndex - b.rowIndex);
  },
};

/** Exported for tests — the grouping and status mapping decide whether a migrated
 *  business's revenue history is right. */
export const orderInternals = { gather, statusOf, paymentStatusOf };

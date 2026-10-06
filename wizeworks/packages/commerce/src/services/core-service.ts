// Core charges: refundable deposits on rebuilt parts (sparx persona issue 051).
//
// A remanufactured part is sold with a deposit on top of its price, and the buyer
// gets the deposit back when the old part (the "core") comes back fit to rebuild.
// The deposit rides on the part's own order line, so picking, stock and sales
// figures never see it as an item. This file answers the three things a parts
// counter does with it:
//
//   listOwed      which customers still owe which cores, and for how long
//   receiveCores  old parts came back: refund the usable ones, keep the rest
//   keepDeposits  a core is not coming back: the deposit is the business's
//
// Money goes back the way it came. An order still owing on an invoice (a fleet on
// Net 30) has the deposit taken off that invoice first: a customer who has not paid
// for the part is never handed back money for it. Anything already paid goes to the
// card it came from (through the gateway when one holds the charge, or recorded
// for the shop to hand back when it was cash or a cheque), or onto the customer's
// account credit when the counter chooses that.

import {
  coresOwed,
  KeepCoreDepositsInput,
  ListCoresOwedInput,
  ReceiveCoresInput,
  ReleaseCoreHoldInput,
  unitsWaitingForCore,
  type CoreOwed,
  type CoreSettlement,
} from '@wizeworks/commerce-schemas';
import { billingPaymentService, orderRefundsService, OWED_DOCUMENT_WHERE } from '@wizeworks/crm';
import { withTenant } from '@wizeworks/db';
import type { Prisma, TxClient } from '@wizeworks/db';
import {
  GatewayNotFoundError,
  PaymentConfigError,
  paymentService,
  takenByGateway,
} from '@wizeworks/payments';

import { writeAuditLog } from '../audit';
import { CommerceConflictError, CommerceNotFoundError, CommerceValidationError } from '../errors';
import type { ServiceContext } from '../errors';
import { CUSTOMER_NAME_SELECT, customerDisplayName } from './customer-name';
import * as discountService from './discount-service';
import { formatAmount } from './money';

/** Cents as money text. */
function asMoney(cents: number, currency: string): string {
  return formatAmount(cents / 100, currency);
}

const DAY_MS = 86_400_000;

const LINE_SELECT = {
  id: true,
  sku: true,
  name: true,
  quantity: true,
  quantityRefunded: true,
  quantityFulfilled: true,
  coreCharge: true,
  coreFirst: true,
  coreHoldReleasedAt: true,
  coresReturned: true,
  coresKept: true,
  order: {
    select: {
      id: true,
      orderNumber: true,
      placedAt: true,
      currency: true,
      status: true,
      customerId: true,
      customer: {
        select: {
          ...CUSTOMER_NAME_SELECT,
          // NOT `company`: the client extension publishes a computed `company` on
          // a customer (their own typed text), and it wins over the relation. The
          // business is read by its id instead, in `businessNames`.
          companyId: true,
        },
      },
    },
  },
} satisfies Prisma.OrderItemSelect;

type CoreLine = Prisma.OrderItemGetPayload<{ select: typeof LINE_SELECT }>;

function toCents(value: Prisma.Decimal | number | null): number {
  return value === null ? 0 : Math.round(Number(value) * 100);
}

/** The name of every business these lines' customers belong to, in one query. */
async function businessNames(tx: TxClient, lines: CoreLine[]): Promise<Map<string, string>> {
  const ids = [
    ...new Set(
      lines.map((l) => l.order.customer.companyId).filter((id): id is string => id !== null)
    ),
  ];
  if (ids.length === 0) return new Map();
  const companies = await tx.company.findMany({
    where: { id: { in: ids } },
    select: { id: true, companyName: true },
  });
  return new Map(companies.map((c) => [c.id, c.companyName]));
}

function toOwed(line: CoreLine, now: Date, businesses: Map<string, string>): CoreOwed {
  const owed = coresOwed(line);
  const core = toCents(line.coreCharge);
  const customer = line.order.customer;
  return {
    orderItemId: line.id,
    orderId: line.order.id,
    orderNumber: line.order.orderNumber,
    placedAt: line.order.placedAt.toISOString(),
    customerId: line.order.customerId,
    customerName: customerDisplayName(customer) ?? 'A customer with no name on file',
    companyId: customer.companyId,
    companyName: customer.companyId ? (businesses.get(customer.companyId) ?? null) : null,
    sku: line.sku,
    name: line.name,
    quantity: line.quantity,
    coreChargeCents: core,
    coreFirst: line.coreFirst,
    waitingToShip: unitsWaitingForCore(line),
    holdReleasedAt: line.coreHoldReleasedAt?.toISOString() ?? null,
    coresOwed: owed,
    coresReturned: line.coresReturned,
    coresKept: line.coresKept,
    owedCents: owed * core,
    daysOut: Math.max(0, Math.floor((now.getTime() - line.order.placedAt.getTime()) / DAY_MS)),
    currency: line.order.currency,
  };
}

/**
 * Every order line with a core still to come back, oldest first.
 *
 * A cancelled order owes nothing: it was never handed over. The rest are read in
 * full and filtered here, because "owed" is a sum of four columns that a database
 * filter would have to repeat, and a second spelling of the rule is how two
 * screens come to disagree.
 */
export async function listOwed(ctx: ServiceContext, rawInput: unknown = {}): Promise<CoreOwed[]> {
  const input = ListCoresOwedInput.parse(rawInput);
  const now = new Date();
  const { lines, businesses } = await withTenant(ctx, async (tx) => {
    const found = await tx.orderItem.findMany({
      where: {
        // A deposit held, or an old part the part is waiting for (issue 057).
        OR: [{ coreCharge: { not: null } }, { coreFirst: true }],
        order: {
          status: { not: 'cancelled' },
          ...(input.orderId ? { id: input.orderId } : {}),
          ...(input.customerId ? { customerId: input.customerId } : {}),
          ...(input.companyId ? { customer: { companyId: input.companyId } } : {}),
          ...(input.olderThanDays !== undefined
            ? { placedAt: { lte: new Date(now.getTime() - input.olderThanDays * DAY_MS) } }
            : {}),
        },
      },
      select: LINE_SELECT,
      orderBy: { order: { placedAt: 'asc' } },
    });
    return { lines: found, businesses: await businessNames(tx, found) };
  });
  return lines
    .map((line) => toOwed(line, now, businesses))
    .filter((row) => row.coresOwed > 0)
    .slice(0, input.limit);
}

async function loadLine(tx: TxClient, orderItemId: string): Promise<CoreLine> {
  const line = await tx.orderItem.findFirst({ where: { id: orderItemId }, select: LINE_SELECT });
  if (!line) throw new CommerceNotFoundError('OrderItem', orderItemId);
  if (line.coreCharge === null && !line.coreFirst) {
    throw new CommerceValidationError(`${line.name} was sold without a core charge.`);
  }
  if (line.order.status === 'cancelled') {
    throw new CommerceConflictError('This order was canceled, so no core is owed on it.');
  }
  return line;
}

function assertOwed(line: CoreLine, count: number): void {
  const owed = coresOwed(line);
  if (count > owed) {
    throw new CommerceConflictError(
      owed === 0
        ? `No cores are still owed for ${line.name} on order ${line.order.orderNumber}.`
        : `Only ${String(owed)} ${owed === 1 ? 'core is' : 'cores are'} still owed for ${line.name} on order ${line.order.orderNumber}.`
    );
  }
}

/**
 * Old parts came back. The usable ones get their deposits back; the unusable ones
 * keep theirs, with the reason the counter gave.
 *
 * The gateway is settled FIRST and outside the transaction, the same order as an
 * order refund: if the card refund fails nothing is written, and the counter can
 * try again. Everything after it (the counts, the invoice credit, the refund
 * record, the account credit) is one transaction.
 */
export async function receiveCores(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<CoreSettlement> {
  const input = ReceiveCoresInput.parse(rawInput);

  // Read and decide. Nothing is written here.
  const plan = await withTenant(ctx, async (tx) => {
    const line = await loadLine(tx, input.orderItemId);
    assertOwed(line, input.usable + input.unusable);
    if (line.coreFirst && input.unusable > 0) {
      throw new CommerceValidationError(
        `Nothing was paid on ${line.name}, so there is no deposit to keep for an old part that cannot be used. Leave it waiting and ask the customer for one that can, or ship it without waiting.`
      );
    }
    const depositCents = input.usable * toCents(line.coreCharge);

    // An invoice still owing on this order takes the deposit first.
    const invoice =
      depositCents === 0
        ? null
        : await tx.billingDocument.findFirst({
            where: { orderId: line.order.id, deletedAt: null, ...OWED_DOCUMENT_WHERE },
            select: { id: true, balance: true, number: true },
            orderBy: { createdAt: 'desc' },
          });
    const invoiceCreditCents = Math.min(depositCents, invoice ? toCents(invoice.balance) : 0);
    const restCents = depositCents - invoiceCreditCents;

    const payment =
      restCents > 0 && input.refundTo === 'original_payment'
        ? await tx.orderPayment.findFirst({
            where: { orderId: line.order.id, status: 'captured' },
            orderBy: { capturedAt: 'desc' },
            select: { id: true, processor: true, processorRef: true, currency: true },
          })
        : null;
    if (restCents > 0 && input.refundTo === 'original_payment' && !payment) {
      throw new CommerceValidationError(
        'No payment has been taken on this order, so there is no deposit to give back. Record the payment first.'
      );
    }
    const paid = await tx.order.findUnique({
      where: { id: line.order.id },
      select: { amountPaid: true },
    });
    if (restCents > toCents(paid?.amountPaid ?? 0)) {
      throw new CommerceValidationError(
        `Only ${asMoney(toCents(paid?.amountPaid ?? 0), line.order.currency)} of this order has been paid, so ${asMoney(restCents, line.order.currency)} cannot go back.`
      );
    }
    return { line, depositCents, invoice, invoiceCreditCents, restCents, payment };
  });

  const { line, invoice, invoiceCreditCents, restCents, payment } = plan;
  const reason = `Core returned: ${line.name}`;

  // Settle at the gateway first, when one is holding the charge.
  let gatewayRefundId: string | undefined;
  const chargeRef =
    restCents > 0 && payment && takenByGateway(payment.processor) ? payment.processorRef : null;
  if (chargeRef) {
    let result;
    try {
      result = await paymentService.refund({
        tenantId: ctx.tenantId,
        chargeId: chargeRef,
        amount: restCents,
        metadata: { sparx_reason: reason.slice(0, 500), sparx_order_item_id: line.id },
      });
    } catch (err) {
      if (err instanceof PaymentConfigError || err instanceof GatewayNotFoundError) {
        throw new CommerceValidationError(
          'No payment gateway is set up to send this deposit back to the card. Give it as account credit instead, or hand it back yourself.'
        );
      }
      throw err;
    }
    if (!result.success) {
      throw new CommerceValidationError(
        `The card refund was refused: ${result.errorMessage ?? 'no reason given'}. Nothing was recorded.`
      );
    }
    gatewayRefundId = result.refundId;
  }

  const money = line.order.currency;
  const settlement = await withTenant(ctx, async (tx) => {
    const composed = { ...ctx, tx };
    // Re-read inside the write: two people at the counter must not both refund
    // the same core.
    const fresh = await loadLine(tx, line.id);
    assertOwed(fresh, input.usable + input.unusable);

    await tx.orderItem.update({
      where: { id: line.id },
      data: {
        coresReturned: { increment: input.usable },
        coresKept: { increment: input.unusable },
      },
    });

    if (invoice && invoiceCreditCents > 0) {
      await billingPaymentService.recordPayment(composed, invoice.id, {
        kind: 'payment',
        method: 'other',
        amount: invoiceCreditCents / 100,
        reference: 'Core returned',
        note: `${String(input.usable)} × ${line.name} (order ${line.order.orderNumber})`,
      });
    }

    let accountCreditCents = 0;
    let refundedCents = 0;
    if (restCents > 0 && input.refundTo === 'account_credit') {
      await discountService.grantAccountCredit(composed, {
        customerId: line.order.customerId,
        amountCents: restCents,
        currency: money,
        reason: 'refund',
        note: `${reason} (order ${line.order.orderNumber})`,
        referenceType: 'OrderItem',
        referenceId: line.id,
      });
      accountCreditCents = restCents;
    }
    if (restCents > 0) {
      // Recorded against the ORDER either way, so its refunded figure and the
      // customer's lifetime spend both count the deposit that went back.
      await orderRefundsService.recordRefund(composed, {
        orderId: line.order.id,
        ...(payment ? { paymentId: payment.id } : {}),
        amount: restCents / 100,
        currency: money,
        reason,
        ...(gatewayRefundId ? { processorRef: gatewayRefundId } : {}),
        metadata: {
          kind: 'core',
          orderItemId: line.id,
          cores: input.usable,
          issuedAs: input.refundTo,
        },
      });
      if (input.refundTo === 'original_payment') refundedCents = restCents;
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.core.received',
      entityType: 'OrderItem',
      entityId: line.id,
      diff: {
        after: {
          usable: input.usable,
          unusable: input.unusable,
          invoiceCreditCents,
          refundedCents,
          accountCreditCents,
          note: input.note ?? null,
        },
      },
    });

    return { refundedCents, accountCreditCents };
  });

  return {
    orderItemId: line.id,
    coresReturned: input.usable,
    coresKept: input.unusable,
    invoiceCreditCents,
    refundedCents: settlement.refundedCents,
    accountCreditCents: settlement.accountCreditCents,
    summary: summarize(
      {
        invoiceCreditCents,
        refundedCents: settlement.refundedCents,
        accountCreditCents: settlement.accountCreditCents,
        kept: input.unusable,
        handBack: Boolean(payment && !chargeRef && settlement.refundedCents > 0),
        invoiceNumber: invoice?.number ?? null,
        readyToShip: line.coreFirst ? input.usable : 0,
      },
      money
    ),
  };
}

/** What happened to the money, in one sentence a counter can read back. */
function summarize(
  parts: {
    invoiceCreditCents: number;
    refundedCents: number;
    accountCreditCents: number;
    kept: number;
    handBack: boolean;
    invoiceNumber: string | null;
    /** Units of a send-first line this arrival lets go. */
    readyToShip: number;
  },
  currency: string
): string {
  const said: string[] = [];
  if (parts.readyToShip > 0) {
    said.push(
      `${String(parts.readyToShip)} ${parts.readyToShip === 1 ? 'part is' : 'parts are'} ready to hand over or send`
    );
  }
  if (parts.invoiceCreditCents > 0) {
    said.push(
      `${asMoney(parts.invoiceCreditCents, currency)} taken off invoice ${parts.invoiceNumber ?? ''}`.trim()
    );
  }
  if (parts.refundedCents > 0) {
    said.push(
      parts.handBack
        ? `${asMoney(parts.refundedCents, currency)} to hand back (it was paid by hand, so give it back the same way)`
        : `${asMoney(parts.refundedCents, currency)} refunded to the card`
    );
  }
  if (parts.accountCreditCents > 0) {
    said.push(`${asMoney(parts.accountCreditCents, currency)} added to their account credit`);
  }
  if (parts.kept > 0) {
    said.push(`${String(parts.kept)} ${parts.kept === 1 ? 'deposit' : 'deposits'} kept`);
  }
  return said.length === 0 ? 'Nothing to give back.' : `${said.join('; ')}.`;
}

/**
 * The core is not coming back, so the deposit is the business's. No money moves:
 * it was paid with the part and stays paid. Recorded so the line stops showing as
 * owed, with the reason the customer will be given.
 */
export async function keepDeposits(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ orderItemId: string; coresKept: number }> {
  const input = KeepCoreDepositsInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const line = await loadLine(tx, input.orderItemId);
    if (line.coreFirst) {
      throw new CommerceValidationError(
        `No deposit was paid on ${line.name}: the customer is sending the old part first. If it is not coming, cancel the line, or ship it without waiting.`
      );
    }
    assertOwed(line, input.quantity);
    const updated = await tx.orderItem.update({
      where: { id: line.id },
      data: { coresKept: { increment: input.quantity } },
      select: { coresKept: true },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.core.kept',
      entityType: 'OrderItem',
      entityId: line.id,
      diff: { after: { quantity: input.quantity, note: input.note } },
    });
    return { orderItemId: line.id, coresKept: updated.coresKept };
  });
}

/**
 * Ship a send-the-old-part-first line before its old part arrives (issue 057).
 *
 * A trusted fleet customer, a breakdown that cannot wait: the business decides the
 * part goes now. No money moves, the old part is still owed and stays on the Cores
 * owed list, and the reason is kept for whoever opens the order next.
 */
export async function releaseHold(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ orderItemId: string; holdReleasedAt: string }> {
  const input = ReleaseCoreHoldInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const line = await loadLine(tx, input.orderItemId);
    if (!line.coreFirst) {
      throw new CommerceValidationError(
        `${line.name} was not bought by sending the old part first, so nothing is waiting for it.`
      );
    }
    if (line.coreHoldReleasedAt !== null) {
      return { orderItemId: line.id, holdReleasedAt: line.coreHoldReleasedAt.toISOString() };
    }
    const updated = await tx.orderItem.update({
      where: { id: line.id },
      data: { coreHoldReleasedAt: new Date() },
      select: { coreHoldReleasedAt: true },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.core.hold_released',
      entityType: 'OrderItem',
      entityId: line.id,
      diff: { after: { note: input.note } },
    });
    return {
      orderItemId: line.id,
      holdReleasedAt: (updated.coreHoldReleasedAt ?? new Date()).toISOString(),
    };
  });
}

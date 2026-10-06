// B2B action executors + the b2b_account scanner (docs/84 Slice F2).
//
// The dunning ladder, re-expressed on the unified engine (docs/81 §3.1) — and the
// SOLE implementation since the `b2b-overdue-worker` cron was retired (Slice F3;
// it was never deployed). A scheduled automation scans `b2b_account`; each account
// with past-due invoices runs the `b2b.escalate_overdue` action, which CALLS the
// reusable `b2bEscalationService.escalateAccount` and then publishes the resulting
// `b2b.*` notifications on the `@wizeworks/events` bus — the reminder / credit-hold /
// suspension events the email-worker consumes.

import {
  installOnce,
  registerAction,
  registerScanner,
  type ActionOutput,
  type EffectInput,
  type ResolvedFields,
  type ScannedRow,
  type TenantCtx,
} from '@wizeworks/automation';
import { accountOrderGate, b2bEscalationService } from '@wizeworks/crm/services';
import {
  billingDocumentMail,
  NOT_OWED_STAGE_TYPES,
  poNumberOf,
  PRICE_OFFER_WORKFLOW_SLUGS,
} from '@wizeworks/crm';
import { resolveSiteOrigin, siteUrl } from '@wizeworks/db/site-origin';
import { enqueueSend } from '@wizeworks/email-sends';
import { publishEvent } from '@wizeworks/events';
import { z } from 'zod';

import { optionalEntityId, requireEntityId } from './entity.js';

/** Prisma Decimal | number | null → number | null. */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface AccountRow {
  id: string;
  status: string;
  companyName: string;
  creditLimit: unknown;
  creditUsed: unknown;
}

/** One row of the per-account overdue aggregate (snake_case from raw SQL). */
interface OverdueAgg {
  account_id: string;
  max_days_past_due: number;
  actionable_count: number;
}

const ACCOUNT_SELECT = {
  id: true,
  status: true,
  companyName: true,
  creditLimit: true,
  creditUsed: true,
} as const;

function accountFields(a: AccountRow, agg: OverdueAgg | undefined): ResolvedFields {
  const creditLimit = num(a.creditLimit);
  const creditUsed = num(a.creditUsed);
  const utilization =
    creditLimit && creditLimit > 0 && creditUsed !== null ? creditUsed / creditLimit : null;
  return {
    'b2bAccount.id': a.id,
    'b2bAccount.status': a.status,
    'b2bAccount.companyName': a.companyName,
    'b2bAccount.creditLimit': creditLimit,
    'b2bAccount.creditUsed': creditUsed,
    'b2bAccount.utilization': utilization,
    'b2bAccount.maxDaysPastDue': agg ? agg.max_days_past_due : 0,
    'b2bAccount.hasOverdueInvoices': agg ? agg.actionable_count > 0 : false,
  };
}

// Optional ladder-threshold overrides; the Locked seed runs with the defaults
// baked into `escalateAccount` (14 / 30). Exposed in config so a cloned
// (Managed) copy can retune them transparently.
const EscalateConfig = z.object({
  creditHoldDays: z.number().int().min(1).optional(),
  suspendDays: z.number().int().min(1).optional(),
});

/** Register the B2B scanner + executor exactly once (idempotent). */
export const installB2bActions = installOnce((): void => {
  // Scheduled scan over B2B accounts. Returns every non-deleted account with its
  // resolved fields; one aggregate query joins in each account's oldest past-due
  // age + whether it has any actionable (unpaid-past-due or overdue) invoice, so
  // the dunning predicate (`hasOverdueInvoices = true`) and a credit-utilization
  // predicate both read off the same scan. RLS scopes both queries to the tenant.
  registerScanner('b2b_account', async (ctx: TenantCtx): Promise<ScannedRow[]> => {
    const accounts = await ctx.tx.company.findMany({
      where: { deletedAt: null },
      select: ACCOUNT_SELECT,
      orderBy: { updatedAt: 'desc' },
      take: 5_000,
    });
    // Past-due open balances, sourced solely from billing_documents (docs/87 §15
    // — net-terms AR converged off the legacy b2b_invoices header in Phase 8). An
    // open net-terms document past its due date is actionable. RLS scopes the
    // query to the tenant.
    // CALENDAR days, in UTC, on both the age and the past-due test — the same
    // rule `daysPastDue` applies everywhere else. Subtracting the timestamps
    // instead counted elapsed 24-hour periods, so an invoice due yesterday
    // afternoon was still "0 days past due" this morning and an account's credit
    // hold landed a day late. `date - date` in Postgres is already whole days.
    // The two joins are the shared "is this money somebody owes" rule, spelled
    // in SQL because this one read is raw. Everything else asks it through
    // `OWED_DOCUMENT_WHERE`; the lists come from the same module either way, so
    // there is no second copy of WHICH workflows and stages, only of the join
    // (issue 857). What it feeds is a credit hold, so a quote counted here stops
    // an account ordering.
    const agg = await ctx.tx.$queryRaw<OverdueAgg[]>`
      SELECT d.company_id AS account_id,
             MAX(GREATEST(0, (now() AT TIME ZONE 'UTC')::date - (d.due_at AT TIME ZONE 'UTC')::date))::int AS max_days_past_due,
             COUNT(*)::int AS actionable_count
      FROM billing_documents d
      JOIN document_workflows w ON w.id = d.workflow_id
      JOIN document_stages   s ON s.id = d.stage_id
      WHERE d.company_id IS NOT NULL AND d.deleted_at IS NULL
        AND d.status IN ('unpaid', 'partial', 'overdue')
        AND NOT (w.slug = ANY(${[...PRICE_OFFER_WORKFLOW_SLUGS]}))
        AND NOT (s.stage_type = ANY(${[...NOT_OWED_STAGE_TYPES]}))
        AND d.balance > 0 AND d.due_at IS NOT NULL
        AND (d.due_at AT TIME ZONE 'UTC')::date < (now() AT TIME ZONE 'UTC')::date
      GROUP BY d.company_id
    `;
    const byAccount = new Map(agg.map((r) => [r.account_id, r]));
    return accounts.map((a) => ({
      id: a.id,
      fields: accountFields(a as AccountRow, byAccount.get(a.id)),
    }));
  });

  registerAction({
    type: 'b2b.escalate_overdue',
    module: 'b2b',
    gates: [],
    manifestNote:
      'Locked B2B dunning: internal account/invoice state transition + b2b.* notifications; global gates suffice',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const cfg = EscalateConfig.parse(effect.config);
      const accountId = requireEntityId(effect.fields, 'b2bAccount.id', 'b2b.escalate_overdue');
      const escalation = await b2bEscalationService.escalateAccount(
        { tenantId: ctx.tenantId, tx: ctx.tx },
        accountId,
        { creditHoldDays: cfg.creditHoldDays, suspendDays: cfg.suspendDays }
      );

      // Publish downstream notifications on the @wizeworks/events bus — the same
      // topics the cron emitted (email-worker consumes them). EngineLogger
      // satisfies PublisherLogger structurally.
      const { publisher, logger } = ctx.deps;
      for (const inv of escalation.freshlyOverdue) {
        await publishEvent(
          publisher,
          'b2b.invoice.overdue',
          ctx.tenantId,
          null,
          {
            invoiceId: inv.id,
            accountId: escalation.accountId,
            invoiceNumber: inv.invoiceNumber,
            amountCents: inv.amountCents,
            overdueDays: inv.overdueDays,
          },
          logger
        );
      }
      if (escalation.transition !== null) {
        await publishEvent(
          publisher,
          escalation.transition === 'suspended'
            ? 'b2b.account.suspended'
            : 'b2b.account.credit_hold',
          ctx.tenantId,
          null,
          {
            accountId: escalation.accountId,
            companyName: escalation.companyName,
            overdueDays: escalation.maxOverdueDays,
          },
          logger
        );
      }

      return {
        accountId: escalation.accountId,
        transition: escalation.transition,
        maxOverdueDays: escalation.maxOverdueDays,
        invoicesMarkedOverdue: escalation.freshlyOverdue.length,
      };
    },
  });

  // Email the invoice to whoever it bills (sparx persona issue 085).
  //
  // The /b2b page promises "orders on terms invoice automatically with the
  // buyer's PO number". The invoice was written automatically and then sat
  // there: nothing sent it, because only the business's Send button ever did.
  // This sends the SAME email that button does (`billingDocumentMail`, one
  // builder for both), queued like every other automated email so suppression
  // is honored and the shop's sender is applied at dispatch, and records that it
  // went so the order page stops saying "Not sent yet".
  //
  // A document with no address to send to refuses, and the run says why: an
  // invoice nobody can receive is a fact the business needs, not a skip.
  registerAction({
    type: 'b2b.send_invoice',
    module: 'b2b',
    gates: [],
    manifestNote:
      'Transactional: emails the triggering invoice to its bill-to through the queued send path (suppression honored, sender applied at dispatch); global gates suffice',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const invoiceId = requireEntityId(effect.fields, 'invoice.id', 'b2b.send_invoice');
      const svc = { tenantId: ctx.tenantId, tx: ctx.tx };
      const email = await billingDocumentMail.billingDocumentEmail(svc, invoiceId);
      const { enqueued, suppressed } = await enqueueSend(
        { tenantId: ctx.tenantId, tx: ctx.tx },
        {
          recipient: email.to,
          customerId: optionalEntityId(effect.fields, 'customer.id') ?? null,
          propertyId: email.propertyId,
          scope: 'transactional',
          // One invoice email per invoice, however often the run is retried.
          dedupeKey: `b2b.send_invoice:${invoiceId}`,
          body: { template: 'invoice-sent', props: email.props },
          variables: { source: 'automation' },
        }
      );
      if (enqueued) {
        await billingDocumentMail.markBillingDocumentSent(svc, invoiceId, {
          to: email.to,
          newDueAt: email.newDueAt,
        });
      }
      return { invoiceId, recipient: email.to, enqueued, suppressed };
    },
  });

  registerAction({
    type: 'b2b.ask_account_approvers',
    module: 'b2b',
    gates: [],
    manifestNote:
      'Transactional: emails the account’s own approvers about the triggering held order through the queued send path (suppression honored, sender applied at dispatch); global gates suffice',
    execute: askAccountApprovers,
  });
});

/** "$58.00", in the order's own currency. */
function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** "3 CS × $96.00", the line as it was bought. `quantity` is always in the base
 *  stocking unit, so a line bought by the case reads back as cases. */
function orderLineSubtitle(
  item: { quantity: number; unitPrice: unknown; uomCode: string | null; unitsPerUom: number },
  currency: string
): string {
  const unit = Number(item.unitPrice);
  if (item.uomCode && item.unitsPerUom > 1 && item.quantity % item.unitsPerUom === 0) {
    const bought = item.quantity / item.unitsPerUom;
    return `${String(bought)} ${item.uomCode} × ${money(unit * item.unitsPerUom, currency)}`;
  }
  return `${String(item.quantity)} × ${money(unit, currency)}`;
}

/**
 * Ask the account's own approvers to sign off a held order (sparx persona
 * issue 087).
 *
 * A business can put somebody on a trade account as "Can approve orders" and
 * set a spending limit the account signs off. The order was held, and the
 * person whose role says they approve orders was never told. This emails each
 * of them, except whoever placed it (nobody signs off their own order), with the
 * order and one button to it on the business's site.
 *
 * Who is asked is read from the order NOW, through the same sign-off rule the
 * Approve buttons use, not from the event: by the time this runs the account
 * may have signed, the order may have been turned down, or the limit may have
 * changed. Asking somebody to approve an order that is not waiting on them sends
 * them to a page with nothing to do.
 *
 * An approver with no email address cannot be asked, and the run says so by
 * name. When NONE of them can, it fails, because the order then waits on people
 * who will never hear about it, and that is a fact the business needs.
 *
 * Exported for its test.
 */
export async function askAccountApprovers(
  ctx: TenantCtx,
  effect: EffectInput
): Promise<ActionOutput> {
  const orderId = requireEntityId(effect.fields, 'order.id', 'b2b.ask_account_approvers');
  const order = await ctx.tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      customerId: true,
      propertyId: true,
      currency: true,
      metadata: true,
      total: true,
      subtotal: true,
      discountTotal: true,
      taxTotal: true,
      shippingTotal: true,
      surchargeTotal: true,
      coreChargeTotal: true,
      customer: { select: { companyId: true, firstName: true, lastName: true, email: true } },
      items: {
        select: {
          name: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          uomCode: true,
          unitsPerUom: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (order?.status !== 'pending_approval') {
    return { orderId, asked: [], skipped: 'The order is no longer waiting for anybody.' };
  }
  const accountId = order.customer.companyId ?? null;
  if (!accountId) {
    return { orderId, asked: [], skipped: 'The order is not on a wholesale account.' };
  }

  const totalCents = Math.round(Number(order.total) * 100);
  const signOff = await accountOrderGate.loadOrderSignOff(ctx.tx, ctx.tenantId, {
    customerId: order.customerId,
    accountId,
    propertyId: order.propertyId ?? null,
    totalCents,
    metadata: order.metadata,
  });
  if (!signOff.state.waitingOn.includes('account')) {
    return {
      orderId,
      asked: [],
      skipped: 'The order is not waiting for the account to approve it.',
    };
  }

  const account = await ctx.tx.company.findUnique({
    where: { id: accountId },
    select: { companyName: true },
  });
  const accountName = account?.companyName ?? 'your account';
  // The site's own name, as every email to a trade buyer is signed: the
  // business they buy from, never the platform.
  const site = order.propertyId
    ? await ctx.tx.property.findUnique({ where: { id: order.propertyId }, select: { name: true } })
    : null;
  const tenant = site
    ? null
    : await ctx.tx.tenant.findUnique({ where: { id: ctx.tenantId }, select: { name: true } });
  const fromName = site?.name ?? tenant?.name ?? 'us';
  // The order on the site it was placed on, where an approver signs it.
  const orderUrl = siteUrl(
    await resolveSiteOrigin(ctx.tx, ctx.tenantId, order.propertyId),
    `/account/b2b/${accountId}/orders/${order.id}`
  );

  const currency = order.currency;
  const limitCents = signOff.rule?.minAmountCents ?? null;
  const baseProps = {
    fromName,
    accountName,
    placedBy: accountOrderGate.signerName(order.customer),
    orderNumber: order.orderNumber,
    total: Number(order.total),
    currency,
    limit: limitCents === null ? null : limitCents / 100,
    poNumber: poNumberOf(order.metadata),
    businessToo: signOff.state.needs.includes('business'),
    lines: order.items.map((item) => ({
      title: item.name,
      subtitle: orderLineSubtitle(item, currency),
      amount: money(Number(item.lineTotal), currency),
    })),
    summary: billingDocumentMail.invoiceSummaryRows(
      {
        subtotal: Number(order.subtotal),
        discountTotal: Number(order.discountTotal),
        taxTotal: Number(order.taxTotal),
        shippingTotal: Number(order.shippingTotal),
        surchargeTotal: Number(order.surchargeTotal),
        coreChargeTotal: Number(order.coreChargeTotal),
        // Nothing is paid on an order nobody has said yes to.
        amountPaid: 0,
      },
      currency
    ),
    orderUrl,
  };

  const reachable = signOff.approvers.filter((a) => a.email);
  const unreachable = signOff.approvers.filter((a) => !a.email).map((a) => a.name);
  if (reachable.length === 0) {
    throw new Error(
      `Nobody who can approve orders at ${accountName} has an email address, so nobody was asked to approve order ${order.orderNumber}. Add an email address to ${unreachable.join(', ') || 'an approver'} on the account, or approve it for them under Approvals.`
    );
  }

  const asked: string[] = [];
  const suppressed: string[] = [];
  for (const approver of reachable) {
    const result = await enqueueSend(
      { tenantId: ctx.tenantId, tx: ctx.tx },
      {
        recipient: approver.email!,
        customerId: approver.customerId,
        propertyId: order.propertyId ?? null,
        scope: 'transactional',
        // One ask per approver per order, however often the run is retried.
        dedupeKey: `b2b.ask_account_approvers:${order.id}:${approver.customerId}`,
        body: {
          template: 'order-approval-request',
          props: { ...baseProps, approverName: approver.name },
        },
        variables: { source: 'automation' },
      }
    );
    if (result.enqueued) asked.push(approver.name);
    if (result.suppressed) suppressed.push(approver.name);
  }
  return { orderId, asked, suppressed, unreachable };
}

// sparx.market settlement (docs/106 §4.7, docs/72 §4) — sparx is merchant-of-record,
// so it owes each seller `gross − commission − refunds` for their marketplace sales.
//
// Two grains:
//   • MarketSettlement     — ONE accrual per market order, recorded atomically with
//     the order at checkout-complete (so a sale never lands without its accrual).
//   • MarketSettlementRun  — the weekly batch: the settlement worker groups a
//     tenant's `accrued` rows for a period into one run, the payout provider ACHes
//     the net, and the report email is sent. This module owns the DB; disbursement
//     + email live in the worker/payout layer.

import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';
import { commissionCents as calcCommissionCents } from '@sparx/commerce-schemas';

import type { ServiceContext } from '../../errors';

/** Record (or refresh) the settlement accrual for a market order — called INSIDE the
 *  order-creation transaction so it is atomic with the sale. Idempotent on orderId. */
export async function recordSettlementAccrualOnTx(
  tx: TxClient,
  tenantId: string,
  input: {
    orderId: string;
    grossCents: number;
    currency: string;
    commissionBps: number;
    paymentRef?: string | null;
  }
): Promise<void> {
  const commission = calcCommissionCents(input.grossCents, input.commissionBps);
  const net = input.grossCents - commission;
  const data = {
    tenantId,
    orderId: input.orderId,
    grossCents: input.grossCents,
    commissionBps: input.commissionBps,
    commissionCents: commission,
    netCents: net,
    currency: input.currency,
    status: 'accrued',
    paymentRef: input.paymentRef ?? null,
  };
  await tx.marketSettlement.upsert({
    where: { orderId: input.orderId },
    create: data,
    update: data,
  });
}

/** Reverse a market order's settlement on refund/cancel — bumps refundedCents and
 *  drops net by the refunded amount (clamped at 0). Idempotent-ish (additive). */
export async function recordSettlementRefund(
  ctx: ServiceContext,
  orderId: string,
  refundCents: number
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const row = await tx.marketSettlement.findUnique({ where: { orderId } });
    if (!row) return;
    const refunded = row.refundedCents + refundCents;
    const net = Math.max(0, row.grossCents - row.commissionCents - refunded);
    await tx.marketSettlement.update({
      where: { orderId },
      data: { refundedCents: refunded, netCents: net },
    });
  });
}

export interface SettlementRunResult {
  runId: string;
  orderCount: number;
  grossCents: number;
  commissionCents: number;
  refundCents: number;
  netCents: number;
  currency: string;
}

/**
 * Roll ALL of a tenant's `accrued` settlements owed as of `periodEnd` into ONE
 * pending run, marking the accruals `included`. Sweeping every accrued row (not a
 * windowed slice) means a released retry from a prior failed run is never stranded;
 * `period` is the report's display window. Returns null when there is nothing to
 * settle. Currency is taken from the accruals (single-currency per run — Phase 1 USD).
 */
export async function computeSettlementRun(
  ctx: ServiceContext,
  period: { periodStart: Date; periodEnd: Date }
): Promise<SettlementRunResult | null> {
  return withTenant(ctx, async (tx) => {
    const accruals = await tx.marketSettlement.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: 'accrued',
        createdAt: { lt: period.periodEnd },
      },
      select: {
        id: true,
        grossCents: true,
        commissionCents: true,
        refundedCents: true,
        netCents: true,
        currency: true,
      },
    });
    if (accruals.length === 0) return null;

    const grossCents = accruals.reduce((s, a) => s + a.grossCents, 0);
    const commissionCents = accruals.reduce((s, a) => s + a.commissionCents, 0);
    const refundCents = accruals.reduce((s, a) => s + a.refundedCents, 0);
    const netCents = accruals.reduce((s, a) => s + a.netCents, 0);
    const currency = accruals[0]?.currency ?? 'USD';

    const run = await tx.marketSettlementRun.create({
      data: {
        tenantId: ctx.tenantId,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        grossCents,
        commissionCents,
        refundCents,
        netCents,
        orderCount: accruals.length,
        currency,
        status: 'pending',
      },
      select: { id: true },
    });

    await tx.marketSettlement.updateMany({
      where: { id: { in: accruals.map((a) => a.id) } },
      data: { runId: run.id, status: 'included' },
    });

    return {
      runId: run.id,
      orderCount: accruals.length,
      grossCents,
      commissionCents,
      refundCents,
      netCents,
      currency,
    };
  });
}

/** Mark a run paid (disbursed). Flips its accruals to `settled`. */
export async function markRunPaid(
  ctx: ServiceContext,
  runId: string,
  disbursement: { provider: string; reference: string | null }
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    await tx.marketSettlementRun.update({
      where: { id: runId },
      data: {
        status: 'paid',
        disbursementProvider: disbursement.provider,
        disbursementRef: disbursement.reference,
        paidAt: new Date(),
      },
    });
    await tx.marketSettlement.updateMany({ where: { runId }, data: { status: 'settled' } });
  });
}

/** Mark a run failed (a disbursement error) AND release its accruals back to
 *  `accrued` (runId cleared) so the next weekly run retries them — the money is
 *  never stranded on a failed run. */
export async function markRunFailed(
  ctx: ServiceContext,
  runId: string,
  reason: string,
  provider?: string
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    await tx.marketSettlementRun.update({
      where: { id: runId },
      data: {
        status: 'failed',
        failureReason: reason.slice(0, 2000),
        ...(provider ? { disbursementProvider: provider } : {}),
      },
    });
    await tx.marketSettlement.updateMany({
      where: { runId },
      data: { status: 'accrued', runId: null },
    });
  });
}

export async function markRunReportSent(ctx: ServiceContext, runId: string): Promise<void> {
  await withTenant(ctx, (tx) =>
    tx.marketSettlementRun.update({ where: { id: runId }, data: { reportEmailSentAt: new Date() } })
  );
}

// ── Dashboard reads ─────────────────────────────────────────────────────────────

export interface SettlementSummary {
  /** Lifetime + current-balance figures (cents). */
  grossCents: number;
  commissionCents: number;
  netCents: number;
  /** Net already paid out via settled runs. */
  paidCents: number;
  /** Net accrued but not yet in a paid run (the upcoming payout). */
  pendingCents: number;
  orderCount: number;
}

/** Aggregate settlement figures for the merchant dashboard. */
export async function getSettlementSummary(ctx: ServiceContext): Promise<SettlementSummary> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.marketSettlement.findMany({
      where: { tenantId: ctx.tenantId },
      select: { grossCents: true, commissionCents: true, netCents: true, status: true },
    });
    let grossCents = 0;
    let commissionCents = 0;
    let netCents = 0;
    let paidCents = 0;
    let pendingCents = 0;
    for (const r of rows) {
      grossCents += r.grossCents;
      commissionCents += r.commissionCents;
      netCents += r.netCents;
      if (r.status === 'settled') paidCents += r.netCents;
      else pendingCents += r.netCents;
    }
    return {
      grossCents,
      commissionCents,
      netCents,
      paidCents,
      pendingCents,
      orderCount: rows.length,
    };
  });
}

export interface SettlementRunRow {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossCents: number;
  commissionCents: number;
  refundCents: number;
  netCents: number;
  orderCount: number;
  currency: string;
  status: string;
  disbursementProvider: string | null;
  disbursementRef: string | null;
  paidAt: string | null;
  createdAt: string;
}

/** The tenant's settlement-run history for the dashboard. */
export async function listSettlementRuns(
  ctx: ServiceContext,
  opts: { take?: number } = {}
): Promise<SettlementRunRow[]> {
  const take = Math.min(Math.max(opts.take ?? 24, 1), 100);
  const runs = await withTenant(ctx, (tx) =>
    tx.marketSettlementRun.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { periodEnd: 'desc' },
      take,
    })
  );
  return runs.map((r) => ({
    id: r.id,
    periodStart: r.periodStart.toISOString(),
    periodEnd: r.periodEnd.toISOString(),
    grossCents: r.grossCents,
    commissionCents: r.commissionCents,
    refundCents: r.refundCents,
    netCents: r.netCents,
    orderCount: r.orderCount,
    currency: r.currency,
    status: r.status,
    disbursementProvider: r.disbursementProvider,
    disbursementRef: r.disbursementRef,
    paidAt: r.paidAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

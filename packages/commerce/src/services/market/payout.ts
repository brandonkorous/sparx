// sparx.market settlement disbursement (docs/106 §4.7, docs/72 §4) — the weekly
// run orchestrator + the ACH payout-provider SEAM.
//
// The provider seam mirrors the channel adapters' "code-complete, live-gated"
// posture: the MANUAL provider is the working default (the run is computed, the
// report is emailed, and sparx ops executes the ACH from the recorded bank details
// out-of-band, then marks it paid). An AUTOMATED rail (Stripe Treasury OutboundPayment
// or a Connect-Custom transfer — a banking decision, not a code gap) plugs into the
// same seam via MARKET_PAYOUTS_PROVIDER, with no change to this orchestrator.

import { withTenant } from '@sparx/db';
import {
  createPublisher,
  publishEvent,
  type EmailSendPayload,
  type PublisherLogger,
} from '@sparx/events';
import { formatBps } from '@sparx/commerce-schemas';
import { appLink, appOrigin } from '@sparx/links/server';

import type { ServiceContext } from '../../errors';

import { getDecryptedPayoutAccount, type DecryptedPayoutAccount } from './merchant';
import {
  computeSettlementRun,
  markRunFailed,
  markRunPaid,
  markRunReportSent,
  type SettlementRunResult,
} from './settlement';

// ── Payout provider seam ────────────────────────────────────────────────────────

export interface PayoutDisburseInput {
  tenantId: string;
  runId: string;
  netCents: number;
  currency: string;
  account: DecryptedPayoutAccount;
}

export interface PayoutResult {
  /** True when funds were actually moved (the run flips to `paid`). */
  disbursed: boolean;
  /** The rail's transfer reference, when disbursed. */
  reference: string | null;
  /** A hard failure (the run flips to `failed`, accruals release for retry). */
  error?: string;
}

export interface MarketPayoutProvider {
  readonly id: string;
  disburse(input: PayoutDisburseInput): Promise<PayoutResult>;
}

/** The working default: no automated ACH rail. The run is computed + reported; sparx
 *  ops executes the ACH from the recorded (decrypted) bank details out-of-band and
 *  marks the run paid. Returns disbursed=false so the run stays `pending` (owed,
 *  reported, awaiting manual disbursement) — never `failed`. */
export class ManualPayoutProvider implements MarketPayoutProvider {
  readonly id = 'manual';
  disburse(_input: PayoutDisburseInput): Promise<PayoutResult> {
    return Promise.resolve({ disbursed: false, reference: null });
  }
}

/** Select the configured disbursement rail. MARKET_PAYOUTS_PROVIDER names the
 *  automated rail once a banking integration is live; until then (and in dev) the
 *  manual provider records the run for out-of-band ACH. A Stripe Treasury /
 *  Connect-Custom provider registers here when that rail is chosen. */
export function resolvePayoutProvider(): MarketPayoutProvider {
  // switch (process.env.MARKET_PAYOUTS_PROVIDER) { case 'stripe_ach': return new StripeAchPayoutProvider(); }
  return new ManualPayoutProvider();
}

// ── Settlement report email ─────────────────────────────────────────────────────

const emailLogger: PublisherLogger = {
  info: (obj, msg) => console.log(JSON.stringify({ level: 'info', ...obj, msg })),
  warn: (obj, msg) => console.warn(JSON.stringify({ level: 'warn', ...obj, msg })),
  error: (obj, msg) => console.error(JSON.stringify({ level: 'error', ...obj, msg })),
};

// Was its own two-name fallback chain, reading a variable set in exactly one of
// the three environments. `appOrigin()` reads every name that has ever meant this
// URL, in one fixed order, so a settlement email points at the same host as a
// domain-renewal one regardless of which service happened to send it.
//
// NO BRAND ARGUMENT, deliberately. This is the sparx marketplace's settlement
// mail, and sparx.market is a sparx PRODUCT that does not exist in Piggles
// (piggles/CLAUDE.md, "A sparx PRODUCT is not a Piggles capability"). A Piggles
// tenant can never be the recipient, so the default brand is not a shortcut here
// — it is the only correct answer. If a marketplace ever spans both brands, this
// takes the tenant's brand like every other emitter.
function dashboardBase(): string {
  return appOrigin();
}

function periodLabel(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

/** Publish the settlement-report `email.send` event for one run (best-effort — a
 *  publish failure never fails the run). */
async function sendSettlementReport(
  ctx: ServiceContext,
  run: SettlementRunResult,
  period: { periodStart: Date; periodEnd: Date },
  account: DecryptedPayoutAccount | null
): Promise<void> {
  const recipient = await withTenant(ctx, async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { email: true },
    });
    const property = await tx.property.findFirst({
      where: { isPrimary: true },
      select: { name: true },
    });
    return { email: tenant?.email ?? null, name: property?.name ?? 'your store' };
  });
  if (!recipient.email) return;

  const pendingBankAccount = !account || account.status === 'disabled';
  const rateBps =
    run.grossCents > 0 ? Math.round((run.commissionCents / run.grossCents) * 10_000) : 0;
  const payoutDestination = pendingBankAccount
    ? 'Add a bank account in your dashboard to receive payouts'
    : `ACH transfer to the account ending ${account?.accountNumber.slice(-4) ?? '••••'}`;

  const payload: EmailSendPayload = {
    to: recipient.email,
    template: 'market-settlement-report',
    props: {
      merchantName: recipient.name,
      periodLabel: periodLabel(period.periodStart, period.periodEnd),
      orderCount: run.orderCount,
      currency: run.currency,
      grossCents: run.grossCents,
      commissionCents: run.commissionCents,
      commissionRateLabel: formatBps(rateBps),
      refundCents: run.refundCents,
      netCents: run.netCents,
      payoutDestination,
      pendingBankAccount,
      settlementUrl: appLink('finance.payouts.list') ?? dashboardBase(),
    },
  };

  const publisher = createPublisher({ logger: emailLogger });
  await publishEvent(publisher, 'email.send', ctx.tenantId, null, payload, emailLogger);
}

// ── The weekly run orchestrator ─────────────────────────────────────────────────

export interface TenantSettlementOutcome extends SettlementRunResult {
  status: 'paid' | 'pending' | 'failed';
  pendingBankAccount: boolean;
}

/**
 * Settle ONE tenant for a period: roll its accrued sales into a run, disburse via
 * the configured rail (or leave pending for manual ACH), email the report. Returns
 * null when the tenant had nothing to settle. Called per active tenant by the
 * weekly settlement cron.
 */
export async function runTenantSettlement(
  ctx: ServiceContext,
  period: { periodStart: Date; periodEnd: Date }
): Promise<TenantSettlementOutcome | null> {
  const run = await computeSettlementRun(ctx, period);
  if (!run) return null;

  const account = await getDecryptedPayoutAccount(ctx);
  const provider = resolvePayoutProvider();
  let status: 'paid' | 'pending' | 'failed' = 'pending';

  if (account && account.status !== 'disabled') {
    const result = await provider.disburse({
      tenantId: ctx.tenantId,
      runId: run.runId,
      netCents: run.netCents,
      currency: run.currency,
      account,
    });
    if (result.disbursed) {
      await markRunPaid(ctx, run.runId, { provider: provider.id, reference: result.reference });
      status = 'paid';
    } else if (result.error) {
      // Hard failure — release the accruals so next week retries them.
      await markRunFailed(ctx, run.runId, result.error, provider.id);
      status = 'failed';
    }
    // else (manual): leave `pending` for out-of-band ACH.
  }

  // Report the run regardless of disbursement outcome (best-effort email).
  try {
    await sendSettlementReport(ctx, run, period, account);
    await markRunReportSent(ctx, run.runId);
  } catch (err) {
    emailLogger.warn({ err, runId: run.runId }, 'settlement report email failed (best-effort)');
  }

  return { ...run, status, pendingBankAccount: !account || account.status === 'disabled' };
}

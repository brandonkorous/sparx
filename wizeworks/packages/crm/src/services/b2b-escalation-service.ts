// B2B dunning ladder — the per-account escalation step (docs/10 §9, docs/64 Ph3,
// docs/81 §3.1, docs/84 Slice F2).
//
// This is the reusable home for the escalation logic. It originally lived ONLY
// inline in the `b2b-overdue-worker` cron (the gap docs/84 flagged: "no reusable
// service"); that cron was never wired into deployment and was deleted in Slice
// F3, so this service — driven by the automation engine's `b2b.escalate_overdue`
// executor, once per account the scheduled `b2b_account` scan surfaces — is now
// the single source of truth for the dunning ladder.
//
// Two deliberate shape choices:
//   • Per-account, not per-tenant batch. The cron did one bulk UPDATE across the
//     whole tenant; the engine model is one run per scanned account, so this
//     escalates a SINGLE account. The observable outcome is identical (every
//     account with past-due invoices is processed), but each commit is small and
//     resumable.
//   • Publisher-agnostic. It does pure DB work and RETURNS what transitioned;
//     the caller emits the `b2b.*` notifications on whichever bus it owns (the
//     executor → `@wizeworks/events`). Mixing the `@wizeworks/events` b2b.* topics into a
//     CRM service that only knows the CRM two-bus would cross a boundary.
//
// Composes into `ctx.tx` when supplied (tx-injection), so the engine commits the
// escalation atomically with its run-step record.

import { withTenant } from '@wizeworks/db';

import { daysPastDue, startOfBusinessDay } from './billing-ar';
import { businessTimeZone } from './business-clock';
import type { ServiceContext } from '../errors';

/** Default ladder thresholds (oldest-overdue age in days). docs/10 §9. */
const DEFAULTS = { creditHoldDays: 14, suspendDays: 30 } as const;

export interface FreshlyOverdueInvoice {
  id: string;
  invoiceNumber: string;
  amountCents: number;
  overdueDays: number;
  /** The AR source. Net-terms balances now live solely on `billing_documents`
   *  (docs/87 §15 — the legacy `b2b_invoices` dual-read was dropped in Phase 8). */
  source: 'billing_document';
}

export interface AccountEscalation {
  accountId: string;
  companyName: string;
  /** Invoices that crossed unpaid → overdue on THIS run (drive the reminder event). */
  freshlyOverdue: FreshlyOverdueInvoice[];
  /** Oldest overdue age across the account's overdue invoices (0 if none). */
  maxOverdueDays: number;
  /** Status the account transitioned TO, or null if unchanged. Monotonic —
   *  never downgrades an account already past the threshold it would set. */
  transition: 'credit_hold' | 'suspended' | null;
}

export interface EscalationThresholds {
  /** Clock override for deterministic tests. Defaults to wall-clock now. */
  now?: Date;
  creditHoldDays?: number;
  suspendDays?: number;
}

/** Whole CALENDAR days past due, never negative — the same rule the aging report,
 *  the receivables screen and the dunning ladder use. It was elapsed 24-hour
 *  periods, which put an account's credit hold a day late whenever its oldest
 *  invoice happened to be raised in the afternoon. */
function pastDueDays(dueAt: Date, now: Date, timeZone: string | null): number {
  return Math.max(0, daysPastDue(dueAt, now, timeZone));
}

/**
 * Run the dunning ladder for ONE B2B account. Marks its past-due unpaid invoices
 * `overdue` (and refreshes `overdue_days` on already-overdue ones), then ladders
 * the account by its oldest-overdue age: ≥ creditHoldDays → `credit_hold` (only
 * from `active`), ≥ suspendDays → `suspended`. Returns the transition + the
 * freshly-overdue invoices for the caller to publish.
 */
export async function escalateAccount(
  ctx: ServiceContext,
  accountId: string,
  opts: EscalationThresholds = {}
): Promise<AccountEscalation> {
  const now = opts.now ?? new Date();
  const creditHoldDays = opts.creditHoldDays ?? DEFAULTS.creditHoldDays;
  const suspendDays = opts.suspendDays ?? DEFAULTS.suspendDays;

  return withTenant(ctx, async (tx) => {
    const account = await tx.company.findUnique({
      where: { id: accountId },
      select: { id: true, status: true, companyName: true },
    });
    if (!account) {
      // The scan that produced this id and the escalation share a tenant tx, so a
      // missing account means it was deleted between scan and run — a clean no-op.
      return {
        accountId,
        companyName: '',
        freshlyOverdue: [],
        maxOverdueDays: 0,
        transition: null,
      };
    }

    const freshlyOverdue: FreshlyOverdueInvoice[] = [];
    let maxOverdueDays = 0;

    // Net-terms AR for this account, now sourced solely from `billing_documents`
    // (docs/87 §15 — `b2b_invoices` retired into the billing engine in Phase 8). A
    // net-terms document carries a `dueAt` (set on finalize) and an open `balance`;
    // past due, it's marked overdue and folds into the dunning ladder. `balance > 0`
    // + a due DATE before today excludes drafts/paid/void.
    //
    // The boundary is midnight at the start of today, not `now`: a bill due TODAY
    // is not late, whatever the clock says. Comparing against `now` marked an
    // invoice overdue on its own due date the moment the hour passed the one it
    // happened to be raised at, and stamped it `overdueDays: 0` — a row saying
    // "overdue by no days".
    //
    // And TODAY is the business's day. A shop in Denver is still on Tuesday for
    // seven hours after the server says Wednesday, and putting an account on
    // credit hold a day early is not a display detail: it stops the account
    // ordering. One read of the zone here, shared by the boundary and the count,
    // so the query cannot select a document the count then calls zero days late.
    const timeZone = await businessTimeZone(tx, ctx.tenantId);
    const startOfToday = startOfBusinessDay(now, timeZone);
    const documents = await tx.billingDocument.findMany({
      where: {
        companyId: accountId,
        deletedAt: null,
        status: { in: ['unpaid', 'partial', 'overdue'] },
        dueAt: { not: null, lt: startOfToday },
        balance: { gt: 0 },
      },
      select: { id: true, status: true, dueAt: true, number: true, balance: true },
    });
    for (const doc of documents) {
      if (!doc.dueAt) continue; // narrows the type; the filter already guarantees it
      const age = pastDueDays(doc.dueAt, now, timeZone);
      maxOverdueDays = Math.max(maxOverdueDays, age);
      const wasOverdue = doc.status === 'overdue';
      await tx.billingDocument.update({
        where: { id: doc.id },
        data: { status: 'overdue', overdueDays: age },
      });
      if (!wasOverdue) {
        freshlyOverdue.push({
          id: doc.id,
          invoiceNumber: doc.number ?? doc.id,
          amountCents: Math.round(Number(doc.balance) * 100),
          overdueDays: age,
          source: 'billing_document',
        });
      }
    }

    // Account ladder — suspend takes precedence; both transitions are one-way.
    let transition: 'credit_hold' | 'suspended' | null = null;
    if (maxOverdueDays >= suspendDays && account.status !== 'suspended') {
      transition = 'suspended';
    } else if (maxOverdueDays >= creditHoldDays && account.status === 'active') {
      transition = 'credit_hold';
    }
    if (transition) {
      await tx.company.update({
        where: { id: accountId },
        data: { status: transition, updatedAt: now },
      });
    }

    return {
      accountId,
      companyName: account.companyName,
      freshlyOverdue,
      maxOverdueDays,
      transition,
    };
  });
}

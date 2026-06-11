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
//     executor → `@sparx/events`). Mixing the `@sparx/events` b2b.* topics into a
//     CRM service that only knows the CRM two-bus would cross a boundary.
//
// Composes into `ctx.tx` when supplied (tx-injection), so the engine commits the
// escalation atomically with its run-step record.

import { withTenant } from '@sparx/db';

import type { ServiceContext } from '../errors';

const MS_PER_DAY = 86_400_000;

/** Default ladder thresholds (oldest-overdue age in days). docs/10 §9. */
const DEFAULTS = { creditHoldDays: 14, suspendDays: 30 } as const;

export interface FreshlyOverdueInvoice {
  id: string;
  invoiceNumber: string;
  amountCents: number;
  overdueDays: number;
  /** Which AR table this open balance came from. During the docs/87 §15
   *  coexistence the ladder reads net-terms balances from BOTH the legacy
   *  `b2b_invoices` header and the authored `billing_documents`. */
  source: 'b2b_invoice' | 'billing_document';
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

function daysPastDue(dueAt: Date, now: Date): number {
  // Whole days, floored, never negative — matches the cron's
  // GREATEST(0, EXTRACT(DAY FROM (now - due_at))::int).
  return Math.max(0, Math.floor((now.getTime() - dueAt.getTime()) / MS_PER_DAY));
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
    const account = await tx.b2BAccount.findUnique({
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

    // Every unpaid/overdue invoice for this account. A single account is a handful
    // of rows, so we recompute age in JS rather than the cron's tenant-wide SQL.
    const invoices = await tx.b2bInvoice.findMany({
      where: { accountId, status: { in: ['unpaid', 'overdue'] } },
      select: { id: true, status: true, dueAt: true, invoiceNumber: true, amountCents: true },
    });

    const freshlyOverdue: FreshlyOverdueInvoice[] = [];
    let maxOverdueDays = 0;

    for (const inv of invoices) {
      if (inv.dueAt >= now) continue; // not past due yet — leave it unpaid
      const age = daysPastDue(inv.dueAt, now);
      maxOverdueDays = Math.max(maxOverdueDays, age);
      const wasUnpaid = inv.status === 'unpaid';
      await tx.b2bInvoice.update({
        where: { id: inv.id },
        data: { status: 'overdue', overdueDays: age },
      });
      if (wasUnpaid) {
        freshlyOverdue.push({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          amountCents: inv.amountCents,
          overdueDays: age,
          source: 'b2b_invoice',
        });
      }
    }

    // Authored billing documents (docs/87 §8) — the second open-balance source
    // during coexistence. A net-terms document carries a `dueAt` (set on
    // finalize) and an open `balance`; past due, it's marked overdue and folds
    // into the same ladder. `balance > 0` + `dueAt < now` excludes drafts/paid.
    const documents = await tx.billingDocument.findMany({
      where: {
        b2bAccountId: accountId,
        deletedAt: null,
        status: { in: ['unpaid', 'partial', 'overdue'] },
        dueAt: { not: null, lt: now },
        balance: { gt: 0 },
      },
      select: { id: true, status: true, dueAt: true, number: true, balance: true },
    });
    for (const doc of documents) {
      if (!doc.dueAt) continue; // narrows the type; the filter already guarantees it
      const age = daysPastDue(doc.dueAt, now);
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
      await tx.b2BAccount.update({
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

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
import { b2bEscalationService } from '@wizeworks/crm/services';
import { NOT_OWED_STAGE_TYPES, PRICE_OFFER_WORKFLOW_SLUGS } from '@wizeworks/crm';
import { publishEvent } from '@wizeworks/events';
import { z } from 'zod';

import { requireEntityId } from './entity.js';

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
});

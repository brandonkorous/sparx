// B2B action executors + the b2b_account scanner (docs/84 Slice F2).
//
// The dunning ladder, re-expressed on the unified engine (docs/81 §3.1). A
// scheduled automation scans `b2b_account`; each account with past-due invoices
// runs the `b2b.escalate_overdue` action, which CALLS the reusable
// `b2bEscalationService.escalateAccount` (the logic that previously lived ONLY
// inline in `services/b2b-overdue-worker/cron.ts`) and then publishes the
// resulting `b2b.*` notifications on the `@sparx/events` bus — the same events the
// cron emitted, so the email-worker's reminder / credit-hold / suspension flows
// are unchanged.

import {
  registerAction,
  registerScanner,
  type ActionOutput,
  type EffectInput,
  type ResolvedFields,
  type ScannedRow,
  type TenantCtx,
} from '@sparx/automation';
import { b2bEscalationService } from '@sparx/crm/services';
import { publishEvent } from '@sparx/events';
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

let installed = false;

/** Register the B2B scanner + executor exactly once (idempotent). */
export function installB2bActions(): void {
  if (installed) return;
  installed = true;

  // Scheduled scan over B2B accounts. Returns every non-deleted account with its
  // resolved fields; one aggregate query joins in each account's oldest past-due
  // age + whether it has any actionable (unpaid-past-due or overdue) invoice, so
  // the dunning predicate (`hasOverdueInvoices = true`) and a credit-utilization
  // predicate both read off the same scan. RLS scopes both queries to the tenant.
  registerScanner('b2b_account', async (ctx: TenantCtx): Promise<ScannedRow[]> => {
    const accounts = await ctx.tx.b2BAccount.findMany({
      where: { deletedAt: null },
      select: ACCOUNT_SELECT,
      orderBy: { updatedAt: 'desc' },
      take: 5_000,
    });
    const agg = await ctx.tx.$queryRaw<OverdueAgg[]>`
      SELECT account_id,
             MAX(GREATEST(0, EXTRACT(DAY FROM (now() - due_at))::int))::int AS max_days_past_due,
             COUNT(*)::int AS actionable_count
      FROM b2b_invoices
      WHERE status IN ('unpaid', 'overdue') AND due_at < now()
      GROUP BY account_id
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
      'Locked B2B dunning — internal account/invoice state transition + b2b.* notifications; global gates suffice',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const cfg = EscalateConfig.parse(effect.config);
      const accountId = requireEntityId(effect.fields, 'b2bAccount.id', 'b2b.escalate_overdue');
      const escalation = await b2bEscalationService.escalateAccount(
        { tenantId: ctx.tenantId, tx: ctx.tx },
        accountId,
        { creditHoldDays: cfg.creditHoldDays, suspendDays: cfg.suspendDays }
      );

      // Publish downstream notifications on the @sparx/events bus — the same
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
}

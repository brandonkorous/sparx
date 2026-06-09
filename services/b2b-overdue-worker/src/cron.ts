// B2B overdue escalation cron — runs once per day via Cloud Scheduler.
//
// Escalation thresholds (docs/10 §9, docs/64 B2B Ph3):
//   0d  past due  → mark status = 'overdue', emit b2b.invoice.overdue
//   7d  past due  → (email-worker handles reminder via b2b.invoice.overdue payload)
//  14d  past due  → account status = 'credit_hold', emit b2b.account.credit_hold
//  30d  past due  → account status = 'suspended', emit b2b.account.suspended
//
// The worker scans ALL tenants. RLS is bypassed via the sparx_owner role
// (the DB connection URL must use sparx_owner, not the tenant-filtered role).
// Per-tenant DB context is set via set_config before every account update so
// the sync_b2b_credit_used trigger works correctly.

import { Prisma, PrismaClient } from '@prisma/client';
import { createPublisher, publishEvent, type PublisherLogger } from '@sparx/events';
import type pino from 'pino';
import { env } from './env.js';

interface EscalationResult {
  tenantsScanned: number;
  invoicesMarkedOverdue: number;
  accountsCreditHold: number;
  accountsSuspended: number;
  errors: number;
}

// Singleton Prisma client for the cron worker (no per-tenant RLS; uses owner role).
let prisma: PrismaClient | null = null;

function getDb(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasourceUrl: env.DATABASE_URL,
      log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return prisma;
}

function makePublisher(logger: pino.Logger) {
  const pubLogger: PublisherLogger = {
    info: (obj, msg) => logger.info(obj, msg),
    warn: (obj, msg) => logger.warn(obj, msg),
    error: (obj, msg) => logger.error(obj, msg),
  };
  return createPublisher({ projectId: env.GCP_PROJECT_ID, logger: pubLogger });
}

export async function runOverdueCheck(logger: pino.Logger): Promise<EscalationResult> {
  const db = getDb();
  const publisher = makePublisher(logger);
  const now = new Date();

  const result: EscalationResult = {
    tenantsScanned: 0,
    invoicesMarkedOverdue: 0,
    accountsCreditHold: 0,
    accountsSuspended: 0,
    errors: 0,
  };

  // Fetch all tenants. No RLS filter needed here — we're the owner role.
  const tenants = await db.tenant.findMany({
    select: { id: true },
  });
  result.tenantsScanned = tenants.length;

  for (const { id: tenantId } of tenants) {
    try {
      await runTenantEscalation(db, publisher, logger, tenantId, now, result);
    } catch (err) {
      logger.error({ tenantId, err }, 'escalation failed for tenant');
      result.errors += 1;
    }
  }

  logger.info(result, 'overdue check complete');
  return result;
}

async function runTenantEscalation(
  db: PrismaClient,
  publisher: ReturnType<typeof makePublisher>,
  logger: pino.Logger,
  tenantId: string,
  now: Date,
  result: EscalationResult
): Promise<void> {
  // Mark all past-due unpaid invoices as overdue and update overdue_days.
  // We use $executeRaw so we can express the age calculation in SQL and
  // avoid loading every invoice row into the Node process.
  const marked = await db.$executeRaw`
    UPDATE b2b_invoices
    SET
      status      = 'overdue',
      overdue_days = GREATEST(0, EXTRACT(DAY FROM (${now}::timestamptz - due_at))::int),
      updated_at   = now()
    WHERE
      tenant_id = ${tenantId}::uuid
      AND status = 'unpaid'
      AND due_at < ${now}::timestamptz
  `;
  result.invoicesMarkedOverdue += marked;

  // Also keep overdue_days current for already-overdue invoices.
  await db.$executeRaw`
    UPDATE b2b_invoices
    SET
      overdue_days = GREATEST(0, EXTRACT(DAY FROM (${now}::timestamptz - due_at))::int),
      updated_at   = now()
    WHERE
      tenant_id = ${tenantId}::uuid
      AND status = 'overdue'
  `;

  // Fetch invoices that cross a threshold and need account escalation.
  // Group by account to avoid redundant updates.
  const overdueInvoices = await db.$queryRaw<
    Array<{ account_id: string; max_overdue_days: number }>
  >`
    SELECT
      account_id,
      MAX(overdue_days) AS max_overdue_days
    FROM b2b_invoices
    WHERE
      tenant_id = ${tenantId}::uuid
      AND status = 'overdue'
      AND overdue_days >= 14
    GROUP BY account_id
  `;

  for (const { account_id: accountId, max_overdue_days: days } of overdueInvoices) {
    const account = await db.b2BAccount.findFirst({
      where: { id: accountId, tenantId },
      select: { id: true, status: true, companyName: true },
    });
    if (!account) continue;

    // Suspended threshold: 30+ days overdue.
    if (days >= 30 && account.status !== 'suspended') {
      await db.b2BAccount.update({
        where: { id: accountId },
        data: { status: 'suspended', updatedAt: now },
      });
      result.accountsSuspended += 1;
      logger.info({ tenantId, accountId, days }, 'account suspended');
      await publishEvent(
        publisher,
        'b2b.account.suspended',
        tenantId,
        null,
        { accountId, companyName: account.companyName, overdueDays: days },
        {
          info: (...a) => logger.info(...(a as Parameters<typeof logger.info>)),
          warn: (...a) => logger.warn(...(a as Parameters<typeof logger.warn>)),
          error: (...a) => logger.error(...(a as Parameters<typeof logger.error>)),
        }
      );
    } else if (days >= 14 && account.status === 'active') {
      // Credit hold threshold: 14+ days overdue, account still active.
      await db.b2BAccount.update({
        where: { id: accountId },
        data: { status: 'credit_hold', updatedAt: now },
      });
      result.accountsCreditHold += 1;
      logger.info({ tenantId, accountId, days }, 'account placed on credit hold');
      await publishEvent(
        publisher,
        'b2b.account.credit_hold',
        tenantId,
        null,
        { accountId, companyName: account.companyName, overdueDays: days },
        {
          info: (...a) => logger.info(...(a as Parameters<typeof logger.info>)),
          warn: (...a) => logger.warn(...(a as Parameters<typeof logger.warn>)),
          error: (...a) => logger.error(...(a as Parameters<typeof logger.error>)),
        }
      );
    }
  }

  // Emit overdue events for invoices that just became overdue (for 7-day reminder emails).
  // The email-worker subscribes to b2b.invoice.overdue and conditionally sends a reminder
  // at 7 days.
  const freshlyOverdue = await db.$queryRaw<
    Array<{
      id: string;
      account_id: string;
      overdue_days: number;
      invoice_number: string;
      amount_cents: number;
    }>
  >`
    SELECT id, account_id, overdue_days, invoice_number, amount_cents
    FROM b2b_invoices
    WHERE
      tenant_id = ${tenantId}::uuid
      AND status = 'overdue'
      AND updated_at >= ${new Date(now.getTime() - 24 * 60 * 60 * 1000)}::timestamptz
  `;

  for (const inv of freshlyOverdue) {
    await publishEvent(
      publisher,
      'b2b.invoice.overdue',
      tenantId,
      null,
      {
        invoiceId: inv.id,
        accountId: inv.account_id,
        invoiceNumber: inv.invoice_number,
        amountCents: inv.amount_cents,
        overdueDays: inv.overdue_days,
      },
      {
        info: (...a) => logger.info(...(a as Parameters<typeof logger.info>)),
        warn: (...a) => logger.warn(...(a as Parameters<typeof logger.warn>)),
        error: (...a) => logger.error(...(a as Parameters<typeof logger.error>)),
      }
    );
  }

  // Sync credit_used for all affected accounts.
  await db.$executeRaw`
    UPDATE b2b_accounts a
    SET credit_used = (
      SELECT COALESCE(SUM(i.amount_cents), 0) / 100.0
      FROM b2b_invoices i
      WHERE i.account_id = a.id AND i.status IN ('unpaid', 'overdue')
    ),
    updated_at = now()
    WHERE a.tenant_id = ${tenantId}::uuid
  `;
}

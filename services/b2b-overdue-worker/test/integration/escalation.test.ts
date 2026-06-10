// B2B overdue escalation — OUTCOME-level coverage for the dunning ladder
// (docs/10 §9, docs/64 B2B Ph3, docs/81 §12 Phase 2).
//
// WHY outcome-level: docs/81 retires this Cloud Run cron and re-expresses the
// dunning ladder as a system automation on the unified engine. When that swap
// lands, `runOverdueCheck` / `runTenantEscalation` disappear — but the contract
// a merchant and the email-worker depend on must not change:
//
//   • an unpaid invoice past its due date becomes `overdue`
//   • an account whose oldest overdue invoice reaches 14 days → `credit_hold`
//   • reaching 30 days → `suspended`
//   • the matching `b2b.account.*` event fires for downstream email
//
// We assert those account-status transitions + emissions, NOT the cron's
// return-counter shape, so this suite survives the Phase-2 handoff untouched.
//
// The worker runs as sparx_owner in prod (superuser / BYPASSRLS) so it can scan
// every tenant and write with an explicit `WHERE tenant_id`. We mirror that
// with a sparx_owner client (MIGRATION_DATABASE_URL); the escalation then
// behaves exactly as it does in production.

import crypto from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import type { Publisher, SparxEvent } from '@sparx/events';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runTenantEscalation, type EscalationResult } from '../../src/cron.js';

const DAY = 86_400_000;

// Captures emitted events in-memory instead of reaching for Pub/Sub.
class CapturingPublisher implements Publisher {
  readonly events: SparxEvent<Record<string, unknown>>[] = [];
  publish<T>(event: SparxEvent<T>): Promise<void> {
    this.events.push(event as unknown as SparxEvent<Record<string, unknown>>);
    return Promise.resolve();
  }
  has(type: string): boolean {
    return this.events.some((e) => e.type === type);
  }
}

function emptyResult(): EscalationResult {
  return {
    tenantsScanned: 0,
    invoicesMarkedOverdue: 0,
    accountsCreditHold: 0,
    accountsSuspended: 0,
    errors: 0,
  };
}

describe('b2b overdue escalation — dunning ladder (outcome-level)', () => {
  // sparx_owner connection mirrors the worker's prod role (BYPASSRLS).
  const db = new PrismaClient({
    datasourceUrl:
      process.env.MIGRATION_DATABASE_URL ??
      'postgresql://sparx_owner:devpassword@localhost:5544/sparx?schema=public',
  });
  const log = pino({ level: 'silent' });
  const createdTenants: string[] = [];

  beforeAll(async () => {
    await db.$connect();
  });

  afterAll(async () => {
    for (const id of createdTenants) {
      await db.tenant.delete({ where: { id } }).catch(() => undefined);
    }
    await db.$disconnect();
  });

  // Seed a fresh tenant + one B2B account + one unpaid invoice that fell due
  // `dueDaysAgo` days ago. Each test gets its own tenant, so order never matters.
  async function seedAccount(opts: {
    dueDaysAgo: number;
    status?: string;
    amountCents?: number;
  }): Promise<{ tenantId: string; accountId: string; invoiceId: string }> {
    const slug = `b2bdun-${crypto.randomBytes(4).toString('hex')}`;
    const tenant = await db.tenant.create({
      data: {
        slug,
        name: slug,
        email: `${slug}@sparx.test`,
        plan: 'starter',
        status: 'active',
        settings: {},
      },
    });
    createdTenants.push(tenant.id);

    const account = await db.b2BAccount.create({
      data: {
        tenantId: tenant.id,
        companyName: `Fleet ${slug}`,
        status: opts.status ?? 'active',
        creditLimit: 10_000,
      },
    });

    const invoice = await db.b2bInvoice.create({
      data: {
        tenantId: tenant.id,
        accountId: account.id,
        invoiceNumber: `INV-${slug}`,
        amountCents: opts.amountCents ?? 50_000,
        status: 'unpaid',
        dueAt: new Date(Date.now() - opts.dueDaysAgo * DAY),
      },
    });

    return { tenantId: tenant.id, accountId: account.id, invoiceId: invoice.id };
  }

  it('marks the invoice overdue and moves the account to credit_hold at 14+ days', async () => {
    const { tenantId, accountId, invoiceId } = await seedAccount({ dueDaysAgo: 20 });
    const pub = new CapturingPublisher();

    await runTenantEscalation(db, pub, log, tenantId, new Date(), emptyResult());

    const account = await db.b2BAccount.findUniqueOrThrow({ where: { id: accountId } });
    expect(account.status).toBe('credit_hold');

    const invoice = await db.b2bInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoice.status).toBe('overdue');
    expect(invoice.overdueDays).toBeGreaterThanOrEqual(14);

    const event = pub.events.find((e) => e.type === 'b2b.account.credit_hold');
    expect(event).toBeDefined();
    expect((event!.data as { accountId: string }).accountId).toBe(accountId);
  });

  it('suspends the account once an invoice is 30+ days overdue', async () => {
    const { tenantId, accountId } = await seedAccount({ dueDaysAgo: 35 });
    const pub = new CapturingPublisher();

    await runTenantEscalation(db, pub, log, tenantId, new Date(), emptyResult());

    const account = await db.b2BAccount.findUniqueOrThrow({ where: { id: accountId } });
    expect(account.status).toBe('suspended');
    expect(pub.has('b2b.account.suspended')).toBe(true);
  });

  it('leaves an account active when nothing has crossed 14 days', async () => {
    const { tenantId, accountId, invoiceId } = await seedAccount({ dueDaysAgo: 5 });
    const pub = new CapturingPublisher();

    await runTenantEscalation(db, pub, log, tenantId, new Date(), emptyResult());

    const account = await db.b2BAccount.findUniqueOrThrow({ where: { id: accountId } });
    expect(account.status).toBe('active');

    // The invoice is still flagged overdue (5 days) — that's the 7-day reminder
    // signal path — but no account-level escalation fired.
    const invoice = await db.b2bInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoice.status).toBe('overdue');
    expect(pub.has('b2b.account.credit_hold')).toBe(false);
    expect(pub.has('b2b.account.suspended')).toBe(false);
  });

  it('is monotonic — a second run never downgrades an already-suspended account', async () => {
    const { tenantId, accountId } = await seedAccount({ dueDaysAgo: 40 });

    await runTenantEscalation(
      db,
      new CapturingPublisher(),
      log,
      tenantId,
      new Date(),
      emptyResult()
    );
    const afterFirst = await db.b2BAccount.findUniqueOrThrow({ where: { id: accountId } });
    expect(afterFirst.status).toBe('suspended');

    // A retry or the next daily tick must hold at suspended and must NOT emit a
    // spurious credit_hold transition for an account that's already past it.
    const pub = new CapturingPublisher();
    await runTenantEscalation(db, pub, log, tenantId, new Date(), emptyResult());
    const afterSecond = await db.b2BAccount.findUniqueOrThrow({ where: { id: accountId } });
    expect(afterSecond.status).toBe('suspended');
    expect(pub.has('b2b.account.credit_hold')).toBe(false);
  });
});

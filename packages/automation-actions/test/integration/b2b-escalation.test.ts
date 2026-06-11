// B2B dunning ladder — END-TO-END on the unified engine (docs/84 Slice F2).
//
// This is the engine successor to `services/b2b-overdue-worker/test/integration/
// escalation.test.ts` (the parity oracle). It drives the FULL scheduled path:
// seed the Locked system automation → runScheduleTick (scan b2b_account, enqueue a
// run per account with past-due invoices) → runAutomationTick (dispatch
// b2b.escalate_overdue → reusable escalateAccount service → DB transition +
// b2b.* events). It asserts the SAME observable contract the cron oracle does —
// invoice → overdue, account → credit_hold (14d) / suspended (30d), matching
// event emitted, monotonic on re-run — proving the swap preserves behavior.
//
// Ticks run on the sparx_app client (the worker's prod identity, FORCE RLS);
// seeding/asserts use a sparx_owner client. The engine publisher is a capturing
// stub so we can assert the b2b.* notifications the executor emits.

import crypto from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import {
  installBuiltins,
  runAutomationTick,
  runScheduleTick,
  type EngineDeps,
} from '@sparx/automation';
import type { Publisher, SparxEvent } from '@sparx/events';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { installB2bActions, seedSystemAutomations } from '../../src/index.js';

const DAY = 86_400_000;

const ownerDb = new PrismaClient({
  datasourceUrl:
    process.env.MIGRATION_DATABASE_URL ??
    'postgresql://sparx_owner:devpassword@localhost:5544/sparx?schema=public',
});
const appDb = new PrismaClient({
  datasourceUrl:
    process.env.DATABASE_URL ??
    'postgresql://sparx_app:devpassword@localhost:5544/sparx?schema=public',
});

// Capturing publisher for the @sparx/events bus — the executor's b2b.* events.
class CapturingPublisher implements Publisher {
  readonly events: SparxEvent<Record<string, unknown>>[] = [];
  publish<T>(event: SparxEvent<T>): Promise<void> {
    this.events.push(event as unknown as SparxEvent<Record<string, unknown>>);
    return Promise.resolve();
  }
  /** Events of `type` carrying this `accountId` — filters out other tenants'
   *  runs that share the cross-tenant tick. */
  forAccount(type: string, accountId: string): SparxEvent<Record<string, unknown>>[] {
    return this.events.filter(
      (e) => e.type === type && (e.data as { accountId?: string }).accountId === accountId
    );
  }
}

const noop = (): void => undefined;
function makeDeps(publisher: Publisher): EngineDeps {
  return { publisher, logger: { debug: noop, info: noop, warn: noop, error: noop } };
}

const createdTenants: string[] = [];

async function seedAccountWithInvoice(opts: {
  dueDaysAgo: number;
  status?: string;
}): Promise<{ tenantId: string; accountId: string; invoiceId: string }> {
  const slug = `b2besc-${crypto.randomBytes(4).toString('hex')}`;
  const tenant = await ownerDb.tenant.create({
    data: {
      slug,
      name: slug,
      email: `${slug}@sparx.test`,
      plan: 'starter',
      status: 'active',
      // The module-active gate reads settings.modules.b2b.enabled directly.
      settings: { modules: { b2b: { enabled: true } } },
    },
    select: { id: true },
  });
  createdTenants.push(tenant.id);

  const account = await ownerDb.b2BAccount.create({
    data: {
      tenantId: tenant.id,
      companyName: `Fleet ${slug}`,
      status: opts.status ?? 'active',
      creditLimit: 10_000,
    },
    select: { id: true },
  });
  const invoice = await ownerDb.b2bInvoice.create({
    data: {
      tenantId: tenant.id,
      accountId: account.id,
      invoiceNumber: `INV-${slug}`,
      amountCents: 50_000,
      status: 'unpaid',
      dueAt: new Date(Date.now() - opts.dueDaysAgo * DAY),
    },
    select: { id: true },
  });
  return { tenantId: tenant.id, accountId: account.id, invoiceId: invoice.id };
}

beforeAll(() => {
  installBuiltins();
  installB2bActions();
});

afterAll(async () => {
  for (const id of createdTenants) {
    await ownerDb.tenant.delete({ where: { id } }).catch(() => undefined);
  }
  await ownerDb.$disconnect();
  await appDb.$disconnect();
});

describe('b2b dunning ladder on the automation engine', () => {
  it('marks the invoice overdue and moves the account to credit_hold at 14+ days', async () => {
    const { tenantId, accountId, invoiceId } = await seedAccountWithInvoice({ dueDaysAgo: 20 });
    const pub = new CapturingPublisher();
    const deps = makeDeps(pub);

    await seedSystemAutomations({ tenantId });
    await runScheduleTick(deps, appDb);
    await runAutomationTick(deps, appDb);

    const account = await ownerDb.b2BAccount.findUniqueOrThrow({ where: { id: accountId } });
    expect(account.status).toBe('credit_hold');

    const invoice = await ownerDb.b2bInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoice.status).toBe('overdue');
    expect(invoice.overdueDays).toBeGreaterThanOrEqual(14);

    expect(pub.forAccount('b2b.account.credit_hold', accountId)).toHaveLength(1);
    // The freshly-overdue invoice fires the reminder event too.
    expect(pub.forAccount('b2b.invoice.overdue', accountId)).toHaveLength(1);
  });

  it('suspends the account once an invoice is 30+ days overdue', async () => {
    const { tenantId, accountId } = await seedAccountWithInvoice({ dueDaysAgo: 35 });
    const pub = new CapturingPublisher();
    const deps = makeDeps(pub);

    await seedSystemAutomations({ tenantId });
    await runScheduleTick(deps, appDb);
    await runAutomationTick(deps, appDb);

    const account = await ownerDb.b2BAccount.findUniqueOrThrow({ where: { id: accountId } });
    expect(account.status).toBe('suspended');
    expect(pub.forAccount('b2b.account.suspended', accountId)).toHaveLength(1);
    expect(pub.forAccount('b2b.account.credit_hold', accountId)).toHaveLength(0);
  });

  it('leaves the account active when nothing has crossed 14 days', async () => {
    const { tenantId, accountId, invoiceId } = await seedAccountWithInvoice({ dueDaysAgo: 5 });
    const pub = new CapturingPublisher();
    const deps = makeDeps(pub);

    await seedSystemAutomations({ tenantId });
    await runScheduleTick(deps, appDb);
    await runAutomationTick(deps, appDb);

    const account = await ownerDb.b2BAccount.findUniqueOrThrow({ where: { id: accountId } });
    expect(account.status).toBe('active');

    // The invoice is still flagged overdue (5 days) — the reminder path — but no
    // account-level escalation fired.
    const invoice = await ownerDb.b2bInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoice.status).toBe('overdue');
    expect(pub.forAccount('b2b.account.credit_hold', accountId)).toHaveLength(0);
    expect(pub.forAccount('b2b.account.suspended', accountId)).toHaveLength(0);
  });

  it('is monotonic — a later tick never downgrades an already-suspended account', async () => {
    const { tenantId, accountId } = await seedAccountWithInvoice({ dueDaysAgo: 40 });

    await seedSystemAutomations({ tenantId });
    await runScheduleTick(makeDeps(new CapturingPublisher()), appDb);
    await runAutomationTick(makeDeps(new CapturingPublisher()), appDb);
    const afterFirst = await ownerDb.b2BAccount.findUniqueOrThrow({ where: { id: accountId } });
    expect(afterFirst.status).toBe('suspended');

    // A new daily window (different dedupe key) re-enqueues the run; the escalation
    // must hold at suspended and NOT re-emit a credit_hold transition.
    const pub2 = new CapturingPublisher();
    const deps2 = makeDeps(pub2);
    await runScheduleTick(deps2, appDb, new Date(Date.now() + DAY));
    await runAutomationTick(deps2, appDb);

    const afterSecond = await ownerDb.b2BAccount.findUniqueOrThrow({ where: { id: accountId } });
    expect(afterSecond.status).toBe('suspended');
    expect(pub2.forAccount('b2b.account.credit_hold', accountId)).toHaveLength(0);
    expect(pub2.forAccount('b2b.account.suspended', accountId)).toHaveLength(0);
  });
});

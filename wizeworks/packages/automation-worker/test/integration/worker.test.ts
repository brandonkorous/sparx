// automation-worker end-to-end (docs/84 Slice D) — drives the REAL HTTP server
// against docker Postgres as sparx_app, the worker's prod identity. Proves the
// whole wiring: Pub/Sub push → handleTrigger (run enqueued), then the Cloud
// Scheduler tick → SECURITY DEFINER discovery + durable drive → run completed.
// If the worker connected with no RLS bypass AND no DEFINER helper, the tick
// would discover zero due runs and this suite would fail — which is the point.

import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { PrismaClient } from '@prisma/client';
import { createAutomation, setAutomationStatus } from '@wizeworks/automation';
import { SYSTEM_AUTOMATIONS } from '@wizeworks/automation-actions';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWorkerServer } from '../../src/server';

const ownerDb = new PrismaClient({
  datasourceUrl:
    process.env.MIGRATION_DATABASE_URL ??
    'postgresql://sparx_owner:devpassword@localhost:5544/sparx?schema=public',
});

const CRON_TOKEN = process.env.SPARX_INTERNAL_CRON_TOKEN!;
const server = createWorkerServer();
let base = '';
const createdTenants: string[] = [];

async function seedTenant(): Promise<string> {
  const slug = `aw-test-${crypto.randomBytes(5).toString('hex')}`;
  const tenant = await ownerDb.tenant.create({
    data: {
      slug,
      name: `AW Test ${slug}`,
      email: `${slug}@sparx.test`,
      plan: 'starter',
      status: 'active',
      settings: { modules: { crm: { enabled: true } } },
    },
    select: { id: true },
  });
  createdTenants.push(tenant.id);
  return tenant.id;
}

async function seedCustomer(tenantId: string): Promise<string> {
  const c = await ownerDb.customer.create({
    data: {
      tenantId,
      type: 'fleet',
      email: `cust-${crypto.randomBytes(3).toString('hex')}@sparx.test`,
    },
    select: { id: true },
  });
  return c.id;
}

function pushBody(tenantId: string, customerId: string): string {
  const envelope = {
    type: 'crm.customer.created',
    tenantId,
    actorId: null,
    occurredAt: new Date().toISOString(),
    data: { customerId },
  };
  return JSON.stringify({
    message: {
      data: Buffer.from(JSON.stringify(envelope)).toString('base64'),
      messageId: crypto.randomUUID(),
      publishTime: new Date().toISOString(),
    },
    subscription: 'projects/test/subscriptions/automation.trigger.automation-worker',
  });
}

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const id of createdTenants) {
    await ownerDb.tenant.delete({ where: { id } }).catch(() => undefined);
  }
  await ownerDb.$disconnect();
});

describe('automation-worker HTTP surface', () => {
  it('GET /healthz returns ok', async () => {
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok', service: 'automation-worker' });
  });

  it('POST /internal/cron/tick rejects a missing/bad token with 403', async () => {
    const noToken = await fetch(`${base}/internal/cron/tick`, { method: 'POST' });
    expect(noToken.status).toBe(403);

    const badToken = await fetch(`${base}/internal/cron/tick`, {
      method: 'POST',
      headers: { 'x-sparx-internal-cron-token': 'wrong' },
    });
    expect(badToken.status).toBe(403);
  });

  it('push enqueues a run, then the authorized tick drives it to completion', async () => {
    const tenantId = await seedTenant();
    const customerId = await seedCustomer(tenantId);

    // Active automation: a single control-flow stop — completes with no module
    // executor and no external effect, so the assertion is deterministic.
    const ctx = { tenantId };
    const automation = await createAutomation(ctx, {
      name: 'worker-e2e',
      trigger: { kind: 'event', eventType: 'crm.customer.created' },
      actions: [{ type: 'platform.stop', config: { reason: 'e2e' } }],
    });
    await setAutomationStatus(ctx, automation.id, 'active');

    // ── Pub/Sub push → handleTrigger enqueues a run ──
    const push = await fetch(`${base}/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: pushBody(tenantId, customerId),
    });
    expect(push.status).toBe(204);

    const enqueued = await ownerDb.automationRun.findFirst({
      where: { automationId: automation.id },
    });
    expect(enqueued?.status).toBe('running');

    // ── Cloud Scheduler tick → DEFINER discovery + durable drive ──
    const tick = await fetch(`${base}/internal/cron/tick`, {
      method: 'POST',
      headers: { 'x-sparx-internal-cron-token': CRON_TOKEN },
    });
    expect(tick.status).toBe(200);
    const summary = (await tick.json()) as {
      schedule: { automations: number; enqueued: number };
      runs: { acquired: boolean; completed: number };
    };
    expect(summary.runs.acquired).toBe(true);
    expect(summary).toHaveProperty('schedule');

    const completed = await ownerDb.automationRun.findUnique({ where: { id: enqueued!.id } });
    expect(completed?.status).toBe('completed');
  });

  it('POST /internal/cron/reconcile-seeds rejects a missing/bad token with 403', async () => {
    const noToken = await fetch(`${base}/internal/cron/reconcile-seeds`, { method: 'POST' });
    expect(noToken.status).toBe(403);

    const badToken = await fetch(`${base}/internal/cron/reconcile-seeds`, {
      method: 'POST',
      headers: { 'x-sparx-internal-cron-token': 'wrong' },
    });
    expect(badToken.status).toBe(403);
  });

  it('the authorized reconcile-seeds tick backfills a module-active tenant', async () => {
    // A b2b-active tenant that never received `module.activated` (predates the
    // engine) — so it has no system automations yet.
    const slug = `aw-recon-${crypto.randomBytes(5).toString('hex')}`;
    const tenant = await ownerDb.tenant.create({
      data: {
        slug,
        name: `AW Recon ${slug}`,
        email: `${slug}@sparx.test`,
        plan: 'starter',
        status: 'active',
        settings: { modules: { b2b: { enabled: true } } },
      },
      select: { id: true },
    });
    createdTenants.push(tenant.id);

    expect(
      await ownerDb.automation.count({ where: { tenantId: tenant.id, origin: 'system' } })
    ).toBe(0);

    const res = await fetch(`${base}/internal/cron/reconcile-seeds`, {
      method: 'POST',
      headers: { 'x-sparx-internal-cron-token': CRON_TOKEN },
    });
    expect(res.status).toBe(200);
    const summary = (await res.json()) as { tenantsSeeded: number };
    expect(summary.tenantsSeeded).toBeGreaterThanOrEqual(1);

    // The full B2B catalog is backfilled — the locked dunning ladder among it.
    //
    // Asserted against the CATALOG, not a hardcoded count. This read
    // `toHaveLength(6)` and went stale the moment B2B grew its two
    // order-approval email seeds: the reconcile pass was correct and the test
    // was wrong, and because integration suites are excluded on CI (see
    // vitest.config.ts — no database there) `main` stayed green while it was
    // red. Deriving the expected NAMES also makes the failure message say which
    // seed is missing instead of "expected 9 to be 6".
    //
    // `module: null` seeds ride along: reconcile installs the always-on catalog
    // for every tenant regardless of which modules are active, so a b2b-only
    // tenant legitimately gets those too.
    const expected = SYSTEM_AUTOMATIONS.filter((s) => s.module === 'b2b' || s.module === null)
      .map((s) => s.spec.name)
      .sort();
    const seeded = await ownerDb.automation.findMany({
      where: { tenantId: tenant.id, origin: 'system' },
      select: { name: true, locked: true },
    });
    expect(seeded.map((a) => a.name).sort()).toEqual(expected);
    const dunning = seeded.find((a) => a.name === 'B2B overdue escalation');
    expect(dunning?.locked).toBe(true);
  });

  it('push with a non-trigger payload acks (204) without enqueuing', async () => {
    const body = JSON.stringify({
      message: {
        data: Buffer.from(JSON.stringify({ not: 'a trigger' })).toString('base64'),
        messageId: crypto.randomUUID(),
        publishTime: new Date().toISOString(),
      },
      subscription: 'projects/test/subscriptions/x',
    });
    const res = await fetch(`${base}/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
    expect(res.status).toBe(204);
  });
});

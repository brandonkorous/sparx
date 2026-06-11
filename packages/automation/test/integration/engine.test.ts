// Engine end-to-end (docs/81 §7, §7.1) — the durable run state machine against
// docker Postgres. Covers: ingest + idempotency, condition filtering, the gated
// dispatcher (allow / deny→gated / transform / defer), fail-stop, durable wait,
// the webhook-egress guard, the kill switch, and scheduled (predicate) triggers.
//
// Module-owned effects (crm.*) aren't wired in this package (they call their
// service in a later slice), so the suite registers STAND-IN executors through
// the same `registerAction` seam the worker uses — proving the machinery without
// pulling service deps. `platform.webhook` is the real built-in.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { getDescriptor, registerAction } from '../../src/actions/registry';
import type { ActionOutput, EffectInput, NamedGate, TenantCtx, TriggerEnvelope } from '../../src';
import { handleTrigger, installBuiltins, runAutomationTick, runScheduleTick } from '../../src';
import {
  createAutomation,
  setAutomationStatus,
  type ServiceCtx,
} from '../../src/service/automation-service';
import {
  createTenant,
  dropTenant,
  getRun,
  makeDeps,
  ownerDb,
  runsFor,
  seedCustomer,
} from '../helpers';

const deps = makeDeps();

// ── test stand-in effects + gates ──
interface Recorded {
  type: string;
  tenantId: string;
  config: Record<string, unknown>;
  fields: Record<string, unknown>;
}
const recorded: Recorded[] = [];
/** The engine tick is intentionally cross-tenant, so a tick in one test drains
 *  leftover `running` runs from earlier (non-ticking) tests into this shared
 *  array. Scope every effect assertion to the test's own tenant. */
const recordedFor = (tenantId: string): Recorded[] =>
  recorded.filter((r) => r.tenantId === tenantId);
let deferCount = 0;

const recorder =
  (type: string) =>
  (ctx: TenantCtx, e: EffectInput): Promise<ActionOutput> => {
    recorded.push({ type, tenantId: ctx.tenantId, config: e.config, fields: e.fields });
    return Promise.resolve({ ok: true });
  };

const denyGate: NamedGate = {
  name: 'test-deny',
  run: () => Promise.resolve({ kind: 'deny', reason: 'test_denied' }),
};
const transformGate: NamedGate = {
  name: 'test-transform',
  run: (_c, e) =>
    Promise.resolve({
      kind: 'transform',
      input: { ...e, config: { ...e.config, transformed: true } },
    }),
};
// Defers exactly once (resumeAt in the past so the very next tick resumes).
const deferOnceGate: NamedGate = {
  name: 'test-defer-once',
  run: () => {
    if (deferCount === 0) {
      deferCount += 1;
      return Promise.resolve({
        kind: 'defer',
        resumeAt: new Date(Date.now() - 1000),
        reason: 'test_defer',
      });
    }
    return Promise.resolve({ kind: 'allow' });
  },
};

function regOnce(
  type: Parameters<typeof getDescriptor>[0],
  gates: NamedGate[],
  execute: (ctx: TenantCtx, e: EffectInput) => Promise<ActionOutput>
): void {
  if (getDescriptor(type)) return;
  registerAction({
    type,
    module: 'crm',
    gates,
    manifestNote: gates.length ? 'test gate' : 'test recorder — no external effect',
    execute,
  });
}

beforeAll(() => {
  installBuiltins();
  regOnce('crm.add_tag', [], recorder('crm.add_tag'));
  regOnce('crm.add_note', [], () => Promise.reject(new Error('boom')));
  regOnce('crm.update_field', [transformGate], recorder('crm.update_field'));
  regOnce('crm.create_task', [denyGate], recorder('crm.create_task'));
  regOnce('crm.update_deal_stage', [deferOnceGate], recorder('crm.update_deal_stage'));
});

beforeEach(() => {
  recorded.length = 0;
  deferCount = 0;
});

const createdTenants: string[] = [];
async function tenant(
  opts: Parameters<typeof createTenant>[0] = { modules: ['crm'] }
): Promise<string> {
  const id = await createTenant(opts);
  createdTenants.push(id);
  return id;
}

afterAll(async () => {
  for (const id of createdTenants) await dropTenant(id);
});

// helper: create an active automation
async function activeAutomation(
  tenantId: string,
  spec: Parameters<typeof createAutomation>[1]
): Promise<string> {
  const ctx: ServiceCtx = { tenantId };
  const a = await createAutomation(ctx, spec);
  await setAutomationStatus(ctx, a.id, 'active');
  return a.id;
}

const evt = (tenantId: string, customerId: string): TriggerEnvelope => ({
  type: 'crm.customer.created',
  tenantId,
  actorId: null,
  occurredAt: new Date().toISOString(),
  data: { customerId },
});

const eventTrigger = { kind: 'event' as const, eventType: 'crm.customer.created' };

describe('engine — ingest + execution', () => {
  it('runs the happy path and records gate decisions', async () => {
    const t = await tenant();
    const customerId = await seedCustomer(t, { type: 'fleet' });
    const autoId = await activeAutomation(t, {
      name: 'tag fleet',
      trigger: eventTrigger,
      actions: [{ type: 'crm.add_tag', config: { tag: 'vip' } }],
    });

    await handleTrigger(evt(t, customerId), deps);

    const [run] = await runsFor(autoId);
    expect(run?.status).toBe('running');

    await runAutomationTick(deps, ownerDb);

    const after = await getRun(run!.id);
    expect(after?.status).toBe('completed');
    expect(recordedFor(t)).toHaveLength(1);
    expect(recordedFor(t)[0]?.fields['customer.id']).toBe(customerId);
    expect(recordedFor(t)[0]?.fields['customer.type']).toBe('fleet');

    const step = after?.steps[0];
    expect(step?.status).toBe('completed');
    const gateLog = step?.gateLog as { gate: string; decision: string }[];
    expect(gateLog.some((g) => g.gate === 'tenant-active' && g.decision === 'allow')).toBe(true);
    expect(gateLog.some((g) => g.gate === 'module-active' && g.decision === 'allow')).toBe(true);
  });

  it('filters on resolved-field conditions', async () => {
    const t = await tenant();
    const autoId = await activeAutomation(t, {
      name: 'fleet only',
      trigger: eventTrigger,
      conditions: {
        logic: 'AND',
        conditions: [{ field: 'customer.type', operator: 'eq', value: 'fleet' }],
      },
      actions: [{ type: 'crm.add_tag', config: {} }],
    });

    const retail = await seedCustomer(t, { type: 'retail' });
    await handleTrigger(evt(t, retail), deps);
    expect(await runsFor(autoId)).toHaveLength(0);

    const fleet = await seedCustomer(t, { type: 'fleet' });
    await handleTrigger(evt(t, fleet), deps);
    expect(await runsFor(autoId)).toHaveLength(1);
  });

  it('collapses an at-least-once redelivery (idempotency)', async () => {
    const t = await tenant();
    const customerId = await seedCustomer(t, { type: 'fleet' });
    const autoId = await activeAutomation(t, {
      name: 'idem',
      trigger: eventTrigger,
      actions: [{ type: 'crm.add_tag', config: {} }],
    });
    const envelope = evt(t, customerId);
    await handleTrigger(envelope, deps);
    await handleTrigger(envelope, deps);
    expect(await runsFor(autoId)).toHaveLength(1);
  });

  it('stops on the first failing action and records it as failed', async () => {
    const t = await tenant();
    const customerId = await seedCustomer(t, {});
    const autoId = await activeAutomation(t, {
      name: 'fail-stop',
      trigger: eventTrigger,
      actions: [
        { type: 'crm.add_tag', config: {} },
        { type: 'crm.add_note', config: {} }, // throws
        { type: 'crm.add_tag', config: {} }, // never reached
      ],
    });
    await handleTrigger(evt(t, customerId), deps);
    await runAutomationTick(deps, ownerDb);

    const [run] = await runsFor(autoId);
    expect(run?.status).toBe('failed');
    expect(run?.steps).toHaveLength(2);
    expect(run?.steps[0]?.status).toBe('completed');
    expect(run?.steps[1]?.status).toBe('failed');
    expect(recordedFor(t)).toHaveLength(1);
  });

  it('parks a durable wait and resumes it on a later tick', async () => {
    const t = await tenant();
    const customerId = await seedCustomer(t, {});
    const autoId = await activeAutomation(t, {
      name: 'wait',
      trigger: eventTrigger,
      actions: [
        { type: 'crm.add_tag', config: {} },
        { type: 'platform.wait', config: { delaySeconds: 0 } },
        { type: 'crm.add_tag', config: {} },
      ],
    });
    await handleTrigger(evt(t, customerId), deps);

    await runAutomationTick(deps, ownerDb);
    let [run] = await runsFor(autoId);
    expect(run?.status).toBe('waiting');
    expect(run?.cursorIndex).toBe(2);
    expect(recordedFor(t)).toHaveLength(1);

    await runAutomationTick(deps, ownerDb);
    [run] = await runsFor(autoId);
    expect(run?.status).toBe('completed');
    expect(recordedFor(t)).toHaveLength(2);
  });

  it('leaves a future wait parked (not yet due)', async () => {
    const t = await tenant();
    const customerId = await seedCustomer(t, {});
    const autoId = await activeAutomation(t, {
      name: 'future-wait',
      trigger: eventTrigger,
      actions: [
        { type: 'platform.wait', config: { delaySeconds: 3600 } },
        { type: 'crm.add_tag', config: {} },
      ],
    });
    await handleTrigger(evt(t, customerId), deps);
    await runAutomationTick(deps, ownerDb);
    await runAutomationTick(deps, ownerDb);
    const [run] = await runsFor(autoId);
    expect(run?.status).toBe('waiting');
    expect(recordedFor(t)).toHaveLength(0);
  });

  it('records a gate deny as `gated` (not failed) and continues the run', async () => {
    const t = await tenant();
    const customerId = await seedCustomer(t, {});
    const autoId = await activeAutomation(t, {
      name: 'gated',
      trigger: eventTrigger,
      actions: [
        { type: 'crm.create_task', config: {} }, // denied by test gate
        { type: 'crm.add_tag', config: {} },
      ],
    });
    await handleTrigger(evt(t, customerId), deps);
    await runAutomationTick(deps, ownerDb);

    const [run] = await runsFor(autoId);
    expect(run?.status).toBe('completed');
    expect(run?.steps[0]?.status).toBe('gated');
    expect(run?.steps[0]?.error).toBe('test_denied');
    expect(run?.steps[1]?.status).toBe('completed');
    expect(recordedFor(t)).toHaveLength(1); // create_task never executed
  });

  it('honors a transform gate — the executor sees the reshaped config', async () => {
    const t = await tenant();
    const customerId = await seedCustomer(t, {});
    await activeAutomation(t, {
      name: 'transform',
      trigger: eventTrigger,
      actions: [{ type: 'crm.update_field', config: { field: 'x' } }],
    });
    await handleTrigger(evt(t, customerId), deps);
    await runAutomationTick(deps, ownerDb);
    expect(recordedFor(t)[0]?.config.transformed).toBe(true);
  });

  it('defers (parks) on a gate defer and re-runs the same action when resumed', async () => {
    const t = await tenant();
    const customerId = await seedCustomer(t, {});
    const autoId = await activeAutomation(t, {
      name: 'defer',
      trigger: eventTrigger,
      actions: [{ type: 'crm.update_deal_stage', config: {} }],
    });
    await handleTrigger(evt(t, customerId), deps);

    await runAutomationTick(deps, ownerDb);
    let [run] = await runsFor(autoId);
    expect(run?.status).toBe('waiting');
    expect(run?.cursorIndex).toBe(0); // NOT advanced — same action re-runs
    expect(recordedFor(t)).toHaveLength(0);

    await runAutomationTick(deps, ownerDb);
    [run] = await runsFor(autoId);
    expect(run?.status).toBe('completed');
    expect(recordedFor(t)).toHaveLength(1);
  });

  it('the kill switch gates every effect', async () => {
    const t = await tenant({ modules: ['crm'], automationsDisabled: true });
    const customerId = await seedCustomer(t, {});
    const autoId = await activeAutomation(t, {
      name: 'killed',
      trigger: eventTrigger,
      actions: [{ type: 'crm.add_tag', config: {} }],
    });
    await handleTrigger(evt(t, customerId), deps);
    await runAutomationTick(deps, ownerDb);
    const [run] = await runsFor(autoId);
    expect(run?.steps[0]?.status).toBe('gated');
    expect(run?.steps[0]?.error).toBe('automations_disabled');
    expect(recordedFor(t)).toHaveLength(0);
  });

  it('the webhook-egress gate blocks a loopback URL', async () => {
    const t = await tenant({ modules: [] });
    const customerId = await seedCustomer(t, {});
    const autoId = await activeAutomation(t, {
      name: 'ssrf',
      trigger: eventTrigger,
      actions: [{ type: 'platform.webhook', config: { url: 'http://127.0.0.1:9/x' } }],
    });
    await handleTrigger(evt(t, customerId), deps);
    await runAutomationTick(deps, ownerDb);
    const [run] = await runsFor(autoId);
    expect(run?.status).toBe('completed');
    expect(run?.steps[0]?.status).toBe('gated');
    expect(run?.steps[0]?.error).toBe('webhook_private_host');
  });
});

describe('engine — scheduled (predicate) triggers', () => {
  it('enqueues one run per matched row, idempotent within the window', async () => {
    const t = await tenant();
    const stale = await seedCustomer(t, { lastOrderDaysAgo: 90 });
    await seedCustomer(t, { lastOrderDaysAgo: 2 }); // active — must NOT match

    const ctx: ServiceCtx = { tenantId: t };
    const a = await createAutomation(ctx, {
      name: 'win-back',
      trigger: {
        kind: 'schedule',
        schedule: { cadence: 'daily', atMinuteUtc: 0 },
        predicate: {
          entity: 'customer',
          where: {
            logic: 'AND',
            conditions: [{ field: 'customer.daysSinceLastOrder', operator: 'gte', value: 30 }],
          },
        },
      },
      actions: [{ type: 'crm.add_tag', config: { tag: 'winback' } }],
    });
    await setAutomationStatus(ctx, a.id, 'active');

    const now = new Date();
    const first = await runScheduleTick(deps, ownerDb, now);
    expect(first.enqueued).toBe(1);

    const second = await runScheduleTick(deps, ownerDb, now);
    expect(second.enqueued).toBe(0); // dedupe within the day window
    expect(await runsFor(a.id)).toHaveLength(1);

    await runAutomationTick(deps, ownerDb);
    const [run] = await runsFor(a.id);
    expect(run?.status).toBe('completed');
    expect(recordedFor(t)).toHaveLength(1);
    expect(recordedFor(t)[0]?.fields['customer.id']).toBe(stale);
  });
});

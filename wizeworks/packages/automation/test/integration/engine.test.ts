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
  updateAutomation,
  type ServiceCtx,
} from '../../src/service/automation-service';
import {
  appDb,
  createTenant,
  dropTenant,
  getRun,
  makeDeps,
  runsFor,
  seedCustomer,
  seedProperty,
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

    await runAutomationTick(deps, appDb);

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
    await runAutomationTick(deps, appDb);

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

    await runAutomationTick(deps, appDb);
    let [run] = await runsFor(autoId);
    expect(run?.status).toBe('waiting');
    expect(run?.cursorIndex).toBe(2);
    expect(recordedFor(t)).toHaveLength(1);

    await runAutomationTick(deps, appDb);
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
    await runAutomationTick(deps, appDb);
    await runAutomationTick(deps, appDb);
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
    await runAutomationTick(deps, appDb);

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
    await runAutomationTick(deps, appDb);
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

    await runAutomationTick(deps, appDb);
    let [run] = await runsFor(autoId);
    expect(run?.status).toBe('waiting');
    expect(run?.cursorIndex).toBe(0); // NOT advanced — same action re-runs
    expect(recordedFor(t)).toHaveLength(0);

    await runAutomationTick(deps, appDb);
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
    await runAutomationTick(deps, appDb);
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
    await runAutomationTick(deps, appDb);
    const [run] = await runsFor(autoId);
    expect(run?.status).toBe('completed');
    expect(run?.steps[0]?.status).toBe('gated');
    expect(run?.steps[0]?.error).toBe('webhook_private_host');
  });
});

// The docs/131 §3.1 defect, as a test. One tenant ("Korous Family Inc.") runs two
// unrelated businesses — a machine shop and a donut shop. Before `property_id`,
// every rule fired on every business's records, so a welcome email written for
// the donut shop reached people who bought brake pads.
//
// These assert the SKIP as hard as the fire. A scoping fix that only proves the
// happy path proves nothing: the whole defect was extra runs, not missing ones.
describe('engine — site scoping', () => {
  it('does not fire a site-scoped rule on another site’s record', async () => {
    const t = await tenant();
    const parts = await seedProperty(t, 'Bobs Parts');
    const donuts = await seedProperty(t, 'Savory Donuts');

    const autoId = await activeAutomation(t, {
      name: 'donut welcome',
      propertyId: donuts,
      trigger: eventTrigger,
      actions: [{ type: 'crm.add_tag', config: { tag: 'welcome' } }],
    });

    // A parts customer. Same tenant, different business.
    const partsCustomer = await seedCustomer(t, { propertyId: parts });
    await handleTrigger(evt(t, partsCustomer), deps);
    expect(await runsFor(autoId)).toHaveLength(0);

    // The donut shop's own customer still fires it.
    const donutCustomer = await seedCustomer(t, { propertyId: donuts });
    await handleTrigger(evt(t, donutCustomer), deps);
    const runs = await runsFor(autoId);
    expect(runs).toHaveLength(1);
    // The run records WHERE it acted, which is what makes "what ran on this
    // site" answerable.
    expect(runs[0]?.propertyId).toBe(donuts);
  });

  it('fires a tenant-wide rule on every site, stamping the site it acted on', async () => {
    const t = await tenant();
    const parts = await seedProperty(t, 'Bobs Parts');
    const donuts = await seedProperty(t, 'Savory Donuts');

    // No propertyId — deliberately tenant-wide.
    const autoId = await activeAutomation(t, {
      name: 'tenant-wide tag',
      trigger: eventTrigger,
      actions: [{ type: 'crm.add_tag', config: { tag: 'all' } }],
    });

    await handleTrigger(evt(t, await seedCustomer(t, { propertyId: parts })), deps);
    await handleTrigger(evt(t, await seedCustomer(t, { propertyId: donuts })), deps);

    const runs = await runsFor(autoId);
    expect(runs).toHaveLength(2);
    // Stamped from the EVENT, not the rule — a tenant-wide rule still produces
    // per-site runs.
    expect(new Set(runs.map((r) => r.propertyId))).toEqual(new Set([parts, donuts]));
  });

  it('withholds a site-scoped rule when the record has no site', async () => {
    const t = await tenant();
    const donuts = await seedProperty(t, 'Savory Donuts');

    const scoped = await activeAutomation(t, {
      name: 'donut only',
      propertyId: donuts,
      trigger: eventTrigger,
      actions: [{ type: 'crm.add_tag', config: {} }],
    });
    const wide = await activeAutomation(t, {
      name: 'tenant wide',
      trigger: eventTrigger,
      actions: [{ type: 'crm.add_tag', config: {} }],
    });

    // A tenant-level contact — imported, or created over MCP. Its site is
    // genuinely unknown, and an unknown site must not be treated as a match:
    // a rule that quietly doesn't run is recoverable, one that emails another
    // business's customers is not.
    const orphan = await seedCustomer(t);
    await handleTrigger(evt(t, orphan), deps);

    expect(await runsFor(scoped)).toHaveLength(0);
    expect(await runsFor(wide)).toHaveLength(1);
  });

  it('re-scoping takes effect immediately, without a publish', async () => {
    const t = await tenant();
    const parts = await seedProperty(t, 'Bobs Parts');
    const donuts = await seedProperty(t, 'Savory Donuts');
    const ctx: ServiceCtx = { tenantId: t };

    const autoId = await activeAutomation(t, {
      name: 'mis-scoped',
      propertyId: parts,
      trigger: eventTrigger,
      actions: [{ type: 'crm.add_tag', config: {} }],
    });

    // Caught firing on the wrong business — corrected in place. Scope is a
    // safety boundary, so unlike an edit to the rule document it must NOT wait
    // in a draft for someone to press Publish.
    await updateAutomation(ctx, autoId, { propertyId: donuts });

    await handleTrigger(evt(t, await seedCustomer(t, { propertyId: parts })), deps);
    expect(await runsFor(autoId)).toHaveLength(0);

    await handleTrigger(evt(t, await seedCustomer(t, { propertyId: donuts })), deps);
    expect(await runsFor(autoId)).toHaveLength(1);
  });

  it('rejects a site belonging to another tenant', async () => {
    const mine = await tenant();
    const theirs = await tenant();
    const theirSite = await seedProperty(theirs, 'Someone Elses Shop');

    // The FK proves the row exists, not that it is yours. RLS on the tenant tx
    // is what makes it invisible — and the error must not distinguish "real but
    // not yours" from "no such site", or it becomes an id oracle.
    await expect(
      createAutomation(
        { tenantId: mine },
        {
          name: 'cross-tenant scope',
          propertyId: theirSite,
          trigger: eventTrigger,
          actions: [{ type: 'crm.add_tag', config: {} }],
        }
      )
    ).rejects.toMatchObject({ code: 'PROPERTY_NOT_FOUND' });
  });

  it('scopes a scheduled sweep to its own site', async () => {
    const t = await tenant();
    const parts = await seedProperty(t, 'Bobs Parts');
    const donuts = await seedProperty(t, 'Savory Donuts');

    // A scan returns the tenant's whole customer set, so this is the path where
    // a missing filter is most obviously wrong — and it reads through the
    // SECURITY DEFINER helper rather than Prisma, which is why the column had to
    // be threaded through the function too.
    const autoId = await activeAutomation(t, {
      name: 'donut win-back',
      propertyId: donuts,
      trigger: {
        kind: 'schedule',
        schedule: { cadence: 'interval', everyMinutes: 1 },
        predicate: {
          entity: 'customer',
          where: {
            logic: 'AND',
            conditions: [{ field: 'customer.type', operator: 'eq', value: 'fleet' }],
          },
        },
      },
      actions: [{ type: 'crm.add_tag', config: {} }],
    });

    await seedCustomer(t, { type: 'fleet', propertyId: parts });
    await seedCustomer(t, { type: 'fleet', propertyId: donuts });

    await runScheduleTick(deps, appDb, new Date(Date.UTC(2026, 0, 1, 0, 0)));

    const runs = await runsFor(autoId);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.propertyId).toBe(donuts);
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
    const first = await runScheduleTick(deps, appDb, now);
    expect(first.enqueued).toBe(1);

    const second = await runScheduleTick(deps, appDb, now);
    expect(second.enqueued).toBe(0); // dedupe within the day window
    expect(await runsFor(a.id)).toHaveLength(1);

    await runAutomationTick(deps, appDb);
    const [run] = await runsFor(a.id);
    expect(run?.status).toBe('completed');
    expect(recordedFor(t)).toHaveLength(1);
    expect(recordedFor(t)[0]?.fields['customer.id']).toBe(stale);
  });
});

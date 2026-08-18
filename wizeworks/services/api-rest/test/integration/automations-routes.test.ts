// Automation engine REST surface (docs/84 Slice G backend) — drives the real
// Fastify app against docker Postgres. Proves the authoring lifecycle (create →
// list → get → update → status → clone → delete), the RBAC boundary (viewer
// reads, editor writes, no-token 401), the LOCKED-tier guard (a platform-managed
// system automation rejects edit/status/delete → 409 AUTOMATION_LOCKED but can be
// cloned), and the run-history reads (list + run-with-steps + 404s).
//
// Automations are a PLATFORM capability (no module gate), so unlike the CRM
// routes these need no module-enable setup — just a tenant + a role.

import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@wizeworks/db';
import { upsertSystemAutomation } from '@wizeworks/automation';
import { createApp } from '../../src/app.js';
import {
  authHeader,
  createTestTenant,
  dropTestTenant,
  signToken,
  type TestTenant,
} from '../helpers.js';

const EVENT_TRIGGER = { kind: 'event' as const, eventType: 'crm.customer.created' };
const STOP_ACTION = { type: 'platform.stop' as const, config: { reason: 'test' } };

function createBody(name: string) {
  return { name, trigger: EVENT_TRIGGER, actions: [STOP_ACTION] };
}

describe('automation routes', () => {
  let app: FastifyInstance;
  const tenants: string[] = [];

  async function tenant(
    role: Parameters<typeof createTestTenant>[0] = 'owner'
  ): Promise<TestTenant> {
    const t = await createTestTenant(role);
    tenants.push(t.tenantId);
    return t;
  }

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    for (const id of tenants) await dropTestTenant(id).catch(() => undefined);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/automations' });
    expect(res.statusCode).toBe(401);
  });

  it('runs the full authoring lifecycle (create → list → get → update → status)', async () => {
    const t = await tenant();
    const token = signToken(app, t);

    // create — always user-origin + draft
    const created = await app.inject({
      method: 'POST',
      url: '/v1/automations',
      headers: authHeader(token),
      payload: createBody('Greet new customers'),
    });
    expect(created.statusCode).toBe(201);
    const automation = created.json().data;
    expect(automation).toMatchObject({
      name: 'Greet new customers',
      origin: 'user',
      status: 'draft',
      locked: false,
    });

    // list — newest first, our row present
    const list = await app.inject({
      method: 'GET',
      url: '/v1/automations',
      headers: authHeader(token),
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.map((a: { id: string }) => a.id)).toContain(automation.id);

    // get one
    const got = await app.inject({
      method: 'GET',
      url: `/v1/automations/${automation.id}`,
      headers: authHeader(token),
    });
    expect(got.statusCode).toBe(200);
    expect(got.json().data.id).toBe(automation.id);

    // update the name
    const patched = await app.inject({
      method: 'PATCH',
      url: `/v1/automations/${automation.id}`,
      headers: authHeader(token),
      payload: { name: 'Welcome new customers' },
    });
    expect(patched.statusCode).toBe(200);
    // A document edit STAGES in the draft — the live row keeps running the
    // published version until `publish` promotes it (automation-service.ts
    // `updateAutomation`, Builder-style draft → publish). So the live `name` is
    // deliberately still the created one here.
    //
    // This assertion used to expect the new name, which was correct BEFORE
    // versioning landed and has been wrong since. Asserting the staged-not-live
    // behaviour is worth more than asserting a string: it is the part of the
    // contract someone could plausibly break without noticing.
    expect(patched.json().data.name).toBe('Greet new customers');
    expect(patched.json().data.draft?.name).toBe('Welcome new customers');

    // activate
    const activated = await app.inject({
      method: 'POST',
      url: `/v1/automations/${automation.id}/status`,
      headers: authHeader(token),
      payload: { status: 'active' },
    });
    expect(activated.statusCode).toBe(200);
    expect(activated.json().data.status).toBe('active');
  });

  it('enforces RBAC — a viewer reads but cannot create', async () => {
    const t = await tenant('viewer');
    const token = signToken(app, t, 'viewer');

    const list = await app.inject({
      method: 'GET',
      url: '/v1/automations',
      headers: authHeader(token),
    });
    expect(list.statusCode).toBe(200);

    const create = await app.inject({
      method: 'POST',
      url: '/v1/automations',
      headers: authHeader(token),
      payload: createBody('nope'),
    });
    expect(create.statusCode).toBe(403);
  });

  it('404s a missing automation and 422s an invalid create body', async () => {
    const t = await tenant();
    const token = signToken(app, t);

    const missing = await app.inject({
      method: 'GET',
      url: `/v1/automations/${crypto.randomUUID()}`,
      headers: authHeader(token),
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('NOT_FOUND');

    const bad = await app.inject({
      method: 'POST',
      url: '/v1/automations',
      headers: authHeader(token),
      payload: { name: '' }, // missing trigger + actions, empty name
    });
    expect(bad.statusCode).toBe(422);
  });

  it('guards the LOCKED tier — edit/status/delete 409, clone allowed', async () => {
    const t = await tenant();
    const token = signToken(app, t);

    // Seed a platform-managed (locked) system automation directly via the seed path.
    const locked = await upsertSystemAutomation(
      { tenantId: t.tenantId },
      {
        name: 'Locked system rule',
        trigger: EVENT_TRIGGER,
        conditions: { logic: 'AND', conditions: [] },
        actions: [STOP_ACTION],
        locked: true,
        status: 'active',
      }
    );

    const edit = await app.inject({
      method: 'PATCH',
      url: `/v1/automations/${locked.id}`,
      headers: authHeader(token),
      payload: { name: 'hijack' },
    });
    expect(edit.statusCode).toBe(409);
    expect(edit.json().error.code).toBe('AUTOMATION_LOCKED');

    const status = await app.inject({
      method: 'POST',
      url: `/v1/automations/${locked.id}/status`,
      headers: authHeader(token),
      payload: { status: 'paused' },
    });
    expect(status.statusCode).toBe(409);

    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/automations/${locked.id}`,
      headers: authHeader(token),
    });
    expect(del.statusCode).toBe(409);

    // …but "Duplicate to edit" forks an editable user-origin copy.
    const clone = await app.inject({
      method: 'POST',
      url: `/v1/automations/${locked.id}/clone`,
      headers: authHeader(token),
      payload: { name: 'My copy' },
    });
    expect(clone.statusCode).toBe(201);
    expect(clone.json().data).toMatchObject({
      name: 'My copy',
      origin: 'user',
      locked: false,
      clonedFrom: locked.id,
    });
  });

  it('deletes a user automation', async () => {
    const t = await tenant();
    const token = signToken(app, t);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/automations',
      headers: authHeader(token),
      payload: createBody('disposable'),
    });
    const id = created.json().data.id;

    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/automations/${id}`,
      headers: authHeader(token),
    });
    expect(del.statusCode).toBe(200);

    const gone = await app.inject({
      method: 'GET',
      url: `/v1/automations/${id}`,
      headers: authHeader(token),
    });
    expect(gone.statusCode).toBe(404);
  });

  it('reads run history — list + run-with-steps + 404s', async () => {
    const t = await tenant();
    const token = signToken(app, t);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/automations',
      headers: authHeader(token),
      payload: createBody('with runs'),
    });
    const automationId = created.json().data.id;

    // No runs yet → empty list (200, not 404).
    const empty = await app.inject({
      method: 'GET',
      url: `/v1/automations/${automationId}/runs`,
      headers: authHeader(token),
    });
    expect(empty.statusCode).toBe(200);
    expect(empty.json().data).toEqual([]);

    // Seed a completed run + one step (RLS-scoped raw insert, like the user helper).
    const runId = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${t.tenantId}'`);
      const run = await tx.automationRun.create({
        data: {
          automationId,
          tenantId: t.tenantId,
          triggerEvent: { type: 'crm.customer.created' },
          dedupeKey: `seed-${crypto.randomBytes(4).toString('hex')}`,
          actionsTotal: 1,
          status: 'completed',
        },
        select: { id: true },
      });
      await tx.automationRunStep.create({
        data: {
          runId: run.id,
          tenantId: t.tenantId,
          actionIndex: 0,
          actionType: 'platform.stop',
          status: 'completed',
        },
      });
      return run.id;
    });

    const runs = await app.inject({
      method: 'GET',
      url: `/v1/automations/${automationId}/runs`,
      headers: authHeader(token),
    });
    expect(runs.statusCode).toBe(200);
    expect(runs.json().data).toHaveLength(1);
    expect(runs.json().data[0].id).toBe(runId);

    const runDetail = await app.inject({
      method: 'GET',
      url: `/v1/automations/${automationId}/runs/${runId}`,
      headers: authHeader(token),
    });
    expect(runDetail.statusCode).toBe(200);
    expect(runDetail.json().data.steps).toHaveLength(1);
    expect(runDetail.json().data.steps[0].actionType).toBe('platform.stop');

    // A run id under the wrong automation → 404.
    const wrong = await app.inject({
      method: 'GET',
      url: `/v1/automations/${crypto.randomUUID()}/runs/${runId}`,
      headers: authHeader(token),
    });
    expect(wrong.statusCode).toBe(404);
  });
});

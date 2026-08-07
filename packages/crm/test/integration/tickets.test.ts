// ticketService + slaPolicyService — service requests against the real schema
// (docs/144 §7).
//
// The clock arithmetic is tested purely in `src/services/sla-clock.test.ts`;
// none of that is repeated here. What this file holds is everything that only
// exists once the database is involved:
//
//   • FILING THE FIRST REQUEST SETS THE WHOLE THING UP. A tenant that has never
//     had a support queue gets one, with a promise attached, in the same
//     transaction — or the very first request is the one nobody was measured on.
//   • THE STAGE IS THE STATUS. Reaching a resolved stage stamps `resolvedAt`;
//     going back to an open one clears it, because a reopened request is
//     genuinely unresolved again.
//   • RE-PRIORITISING RE-PROMISES, measured from when the request ARRIVED.
//   • THE INTAKE FIRES TWICE. Automations retry, so a rule that runs again on
//     one conversation must not open a second request.
//   • THE SWEEP RUNS EVERY FIVE MINUTES, FOREVER. It has to announce each
//     breach exactly once, no matter how many times it runs.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@sparx/db';
import {
  customerService,
  slaPolicyService,
  ticketService,
  ticketSlaSweep,
} from '../../src/services/index.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

/** Open around the clock, so a test's expectations are plain wall-clock
 *  arithmetic. The business-hours cases live in the pure clock tests. */
const ALWAYS_OPEN = { timezone: 'UTC', businessHours: [], holidays: [] };

async function stagesOf(ctx: TestContext) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${ctx.tenant.tenantId}'`);
    const pipeline = await tx.pipeline.findFirstOrThrow({
      where: { objectKey: 'ticket' },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    });
    return pipeline.stages;
  });
}

async function activitiesFor(tenantId: string, customerId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    return tx.crmActivity.findMany({ where: { customerId }, orderBy: { occurredAt: 'asc' } });
  });
}

describe('ticketService', () => {
  let context: TestContext;
  let customerId: string;

  beforeAll(async () => {
    context = await makeTestContext();
  });

  afterAll(async () => {
    await disposeTestContext(context);
  });

  beforeEach(async () => {
    context.publisher.clear();
    const customer = await customerService.create(context.ctx, {
      email: `requester-${Math.random().toString(36).slice(2, 8)}@example.test`,
      firstName: 'Dana',
      lastName: 'Reyes',
    });
    customerId = customer.id;
  });

  /* ── Opening one ──────────────────────────────────────────────────────── */

  it('builds the queue and the promise on the very first request', async () => {
    const view = await ticketService.create(context.ctx, {
      subject: 'Replacement arrived damaged',
      customerId,
    });

    expect(view.ticket.number).toBeGreaterThan(0);
    expect(view.ticket.stage?.name).toBe('New');
    // The promise exists AND was applied — a queue with no clock on it would
    // pass a shallower assertion.
    expect(view.ticket.slaPolicyId).not.toBeNull();
    expect(view.firstResponse.state).toBe('ok');
    expect(view.ticket.firstResponseDueAt).not.toBeNull();
    expect(view.ticket.firstResponseWarnAt).not.toBeNull();

    const stages = await stagesOf(context);
    expect(stages.map((s) => s.stageType)).toEqual(['open', 'open', 'open', 'resolved', 'closed']);
  });

  it('numbers requests per tenant, monotonically', async () => {
    const first = await ticketService.create(context.ctx, { subject: 'One', customerId });
    const second = await ticketService.create(context.ctx, { subject: 'Two', customerId });
    expect(second.ticket.number).toBe(first.ticket.number + 1);
  });

  it('opens the request on the timeline and announces it', async () => {
    const view = await ticketService.create(context.ctx, {
      subject: 'Where is my order',
      customerId,
    });

    const activities = await activitiesFor(context.tenant.tenantId, customerId);
    expect(activities.some((a) => a.type === 'ticket.opened')).toBe(true);

    const created = context.publisher.events.filter((e) => e.topic === 'crm.ticket.created');
    expect(created).toHaveLength(1);
    expect(created[0]?.payload.ticketId).toBe(view.ticket.id);
  });

  it('promises nothing when the caller explicitly says so', async () => {
    // Explicit null must not fall through to the tenant default — "no promise on
    // this one" has to stay expressible, or a bulk import of historical requests
    // would arrive looking overdue.
    const view = await ticketService.create(context.ctx, {
      subject: 'Imported from the old system',
      customerId,
      slaPolicyId: null,
    });
    expect(view.ticket.slaPolicyId).toBeNull();
    expect(view.ticket.firstResponseDueAt).toBeNull();
    expect(view.firstResponse.state).toBe('none');
  });

  /* ── The intake fires twice ───────────────────────────────────────────── */

  it('returns the SAME request when a routing rule fires again on one conversation', async () => {
    const first = await ticketService.create(context.ctx, {
      subject: 'Live chat',
      customerId,
      source: 'chat',
      sourceRecordId: 'conversation-42',
    });
    const second = await ticketService.create(context.ctx, {
      subject: 'Live chat',
      customerId,
      source: 'chat',
      sourceRecordId: 'conversation-42',
    });

    expect(second.ticket.id).toBe(first.ticket.id);
    // And it stays quiet the second time: an automation retry must not announce
    // a new request to every rule listening.
    expect(context.publisher.events.filter((e) => e.topic === 'crm.ticket.created')).toHaveLength(
      1
    );
  });

  it('lets the same origin id repeat across DIFFERENT intakes', async () => {
    // A chat conversation and a form submission may share an id from two
    // unrelated modules; the dedupe key is (source, id), not id alone.
    await ticketService.create(context.ctx, {
      subject: 'From chat',
      customerId,
      source: 'chat',
      sourceRecordId: 'shared-id',
    });
    const fromForm = await ticketService.create(context.ctx, {
      subject: 'From a form',
      customerId,
      source: 'form',
      sourceRecordId: 'shared-id',
    });
    expect(fromForm.ticket.subject).toBe('From a form');
  });

  /* ── The stage IS the status ──────────────────────────────────────────── */

  it('stamps resolvedAt on a resolved stage and clears it on reopen', async () => {
    const view = await ticketService.create(context.ctx, { subject: 'Faulty part', customerId });
    const stages = await stagesOf(context);
    const resolved = stages.find((s) => s.stageType === 'resolved');
    const open = stages.find((s) => s.stageType === 'open');

    const done = await ticketService.moveStage(context.ctx, view.ticket.id, {
      toStageId: resolved?.id,
    });
    expect(done.ticket.resolvedAt).not.toBeNull();
    expect(done.ticket.closedAt).toBeNull();
    expect(done.resolution.state).toBe('met');

    const reopened = await ticketService.moveStage(context.ctx, view.ticket.id, {
      toStageId: open?.id,
    });
    // A reopened request is genuinely unresolved again — a queue still showing
    // it as answered would be lying about work somebody still owes.
    expect(reopened.ticket.resolvedAt).toBeNull();
  });

  it('keeps the FIRST resolution time when a resolved request is re-moved', async () => {
    const view = await ticketService.create(context.ctx, { subject: 'Warranty', customerId });
    const stages = await stagesOf(context);
    const resolved = stages.find((s) => s.stageType === 'resolved');
    const closed = stages.find((s) => s.stageType === 'closed');

    const first = await ticketService.moveStage(context.ctx, view.ticket.id, {
      toStageId: resolved?.id,
    });
    const filed = await ticketService.moveStage(context.ctx, view.ticket.id, {
      toStageId: closed?.id,
    });

    // Otherwise an administrative tidy-up silently improves every report.
    expect(filed.ticket.resolvedAt?.getTime()).toBe(first.ticket.resolvedAt?.getTime());
    expect(filed.ticket.closedAt).not.toBeNull();
  });

  it('refuses a stage from another pipeline', async () => {
    const view = await ticketService.create(context.ctx, { subject: 'Mismatch', customerId });
    const otherStageId = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${context.tenant.tenantId}'`);
      const pipeline = await tx.pipeline.create({
        data: {
          tenantId: context.tenant.tenantId,
          objectKey: 'ticket',
          name: 'Another queue',
          slug: 'another-queue',
          stages: { create: [{ tenantId: context.tenant.tenantId, name: 'Start', sortOrder: 0 }] },
        },
        include: { stages: true },
      });
      return pipeline.stages[0]?.id;
    });

    await expect(
      ticketService.moveStage(context.ctx, view.ticket.id, { toStageId: otherStageId })
    ).rejects.toThrow(/different queue/i);
  });

  /* ── Re-prioritising re-promises ──────────────────────────────────────── */

  it('recomputes the deadline from when the request ARRIVED, not from the escalation', async () => {
    const policy = await slaPolicyService.create(context.ctx, {
      name: 'Round the clock',
      // NOT the default. These tests share a tenant, and promoting a policy
      // whose only targets are low/urgent would leave every `medium` request in
      // the file with no deadline — which is correct behaviour, and would make
      // three unrelated tests fail for a reason that has nothing to do with them.
      isDefault: false,
      ...ALWAYS_OPEN,
      targets: [
        { priority: 'low', firstResponseMinutes: 600 },
        { priority: 'urgent', firstResponseMinutes: 60 },
      ],
    });

    const view = await ticketService.create(context.ctx, {
      subject: 'Escalating',
      customerId,
      priority: 'low',
      slaPolicyId: policy.id,
    });
    const openedAt = view.ticket.createdAt.getTime();
    expect(view.ticket.firstResponseDueAt?.getTime()).toBe(openedAt + 600 * 60_000);

    const escalated = await ticketService.update(context.ctx, view.ticket.id, {
      priority: 'urgent',
    });
    // Sixty minutes from ARRIVAL. Restarting the clock at the escalation would
    // reward being slow to notice how urgent something was.
    expect(escalated.ticket.firstResponseDueAt?.getTime()).toBe(openedAt + 60 * 60_000);
  });

  it('clears the already-announced marks when the promise changes', async () => {
    const policy = await slaPolicyService.create(context.ctx, {
      name: 'Re-announce',
      isDefault: false,
      ...ALWAYS_OPEN,
      targets: [
        { priority: 'low', firstResponseMinutes: 600 },
        { priority: 'urgent', firstResponseMinutes: 60 },
      ],
    });
    const view = await ticketService.create(context.ctx, {
      subject: 'Was quiet, now loud',
      customerId,
      priority: 'low',
      slaPolicyId: policy.id,
    });

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${context.tenant.tenantId}'`);
      await tx.ticket.update({
        where: { id: view.ticket.id },
        data: { firstResponseWarnedAt: new Date(), firstResponseBreachedAt: new Date() },
      });
    });

    const escalated = await ticketService.update(context.ctx, view.ticket.id, {
      priority: 'urgent',
    });
    // A NEW promise has not been reported on yet. Leaving the old marks would
    // keep the sweep silent about a deadline it has never actually announced.
    expect(escalated.ticket.firstResponseWarnedAt).toBeNull();
    expect(escalated.ticket.firstResponseBreachedAt).toBeNull();
  });

  it('leaves the deadlines alone on an ordinary edit', async () => {
    const view = await ticketService.create(context.ctx, { subject: 'Typo', customerId });
    const before = view.ticket.firstResponseDueAt?.getTime();
    const renamed = await ticketService.update(context.ctx, view.ticket.id, {
      subject: 'Typo fixed',
    });
    expect(renamed.ticket.firstResponseDueAt?.getTime()).toBe(before);
  });

  /* ── Answering ────────────────────────────────────────────────────────── */

  it('records the first response once, and only once', async () => {
    const view = await ticketService.create(context.ctx, { subject: 'Question', customerId });
    const first = new Date(Date.now() - 60_000);

    await ticketService.recordFirstResponse(context.ctx, view.ticket.id, first);
    await ticketService.recordFirstResponse(context.ctx, view.ticket.id, new Date());

    const after = await ticketService.get(context.ctx, view.ticket.id);
    // A thread of six replies still measures the first one.
    expect(after.ticket.firstRespondedAt?.getTime()).toBe(first.getTime());
    expect(after.firstResponse.state).toBe('met');
  });

  /* ── Listing the queue ────────────────────────────────────────────────── */

  it('hides resolved requests from the queue by default', async () => {
    const open = await ticketService.create(context.ctx, { subject: 'Still open', customerId });
    const done = await ticketService.create(context.ctx, { subject: 'Finished', customerId });
    const stages = await stagesOf(context);
    await ticketService.moveStage(context.ctx, done.ticket.id, {
      toStageId: stages.find((s) => s.stageType === 'resolved')?.id,
    });

    const queue = await ticketService.list(context.ctx, {});
    const ids = queue.items.map((v) => v.ticket.id);
    expect(ids).toContain(open.ticket.id);
    expect(ids).not.toContain(done.ticket.id);

    const everything = await ticketService.list(context.ctx, { query: { state: 'all' } });
    expect(everything.items.map((v) => v.ticket.id)).toContain(done.ticket.id);
  });

  it('finds a request by its human number', async () => {
    const view = await ticketService.create(context.ctx, { subject: 'Findable', customerId });
    const found = await ticketService.list(context.ctx, {
      query: { q: String(view.ticket.number) },
    });
    expect(found.items.map((v) => v.ticket.id)).toContain(view.ticket.id);
  });

  it('filters to the unassigned queue', async () => {
    const mine = await ticketService.create(context.ctx, { subject: 'Mine', customerId });
    await ticketService.create(context.ctx, { subject: 'Nobody has this', customerId });
    await ticketService.assign(context.ctx, mine.ticket.id, {
      assignedToUserId: context.tenant.userId,
    });

    // Membership, not an exact list: these tests share a tenant, so every
    // request the file has already opened is legitimately unassigned too.
    const unclaimed = await ticketService.list(context.ctx, {
      query: { unassigned: true, take: 250 },
    });
    const ids = unclaimed.items.map((v) => v.ticket.id);
    expect(ids).not.toContain(mine.ticket.id);
    expect(unclaimed.items.some((v) => v.ticket.subject === 'Nobody has this')).toBe(true);
  });

  it('drops a soft-deleted request out of the queue', async () => {
    const view = await ticketService.create(context.ctx, { subject: 'Spam', customerId });
    await ticketService.softDelete(context.ctx, view.ticket.id);
    const queue = await ticketService.list(context.ctx, { query: { state: 'all' } });
    expect(queue.items.map((v) => v.ticket.id)).not.toContain(view.ticket.id);
  });
});

/* ── The sweep ──────────────────────────────────────────────────────────── */

describe('ticketSlaSweep', () => {
  let context: TestContext;
  let customerId: string;

  beforeAll(async () => {
    context = await makeTestContext();
    const customer = await customerService.create(context.ctx, {
      email: `sweep-${Math.random().toString(36).slice(2, 8)}@example.test`,
      firstName: 'Sam',
      lastName: 'Okafor',
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    await disposeTestContext(context);
  });

  beforeEach(() => {
    context.publisher.clear();
  });

  /** A request whose deadlines are placed by hand — the sweep is what is under
   *  test, not the clock that normally sets them. */
  async function requestDue(minutesFromNow: number, warnMinutesFromNow: number) {
    const view = await ticketService.create(context.ctx, {
      subject: `Due in ${String(minutesFromNow)}`,
      customerId,
      slaPolicyId: null,
    });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${context.tenant.tenantId}'`);
      await tx.ticket.update({
        where: { id: view.ticket.id },
        data: {
          firstResponseDueAt: new Date(Date.now() + minutesFromNow * 60_000),
          firstResponseWarnAt: new Date(Date.now() + warnMinutesFromNow * 60_000),
        },
      });
    });
    return view.ticket.id;
  }

  it('announces a breach exactly once, however often it runs', async () => {
    const id = await requestDue(-30, -60);

    const first = await ticketSlaSweep.sweepTenant(context.ctx);
    expect(first.firstResponseBreached).toBe(1);

    const second = await ticketSlaSweep.sweepTenant(context.ctx);
    const third = await ticketSlaSweep.sweepTenant(context.ctx);
    expect(second.firstResponseBreached).toBe(0);
    expect(third.firstResponseBreached).toBe(0);

    const announced = context.publisher.events.filter(
      (e) => e.topic === 'crm.ticket.sla.breached' && e.payload.ticketId === id
    );
    expect(announced).toHaveLength(1);
  });

  it('warns before the deadline, and not after it has passed', async () => {
    const approaching = await requestDue(20, -5);
    const alreadyLate = await requestDue(-20, -60);

    await ticketSlaSweep.sweepTenant(context.ctx);

    const warned = context.publisher.events.filter((e) => e.topic === 'crm.ticket.sla.warning');
    const breached = context.publisher.events.filter((e) => e.topic === 'crm.ticket.sla.breached');
    expect(warned.map((e) => e.payload.ticketId)).toEqual([approaching]);
    // Telling somebody a deadline is approaching after it has passed is noise.
    expect(breached.map((e) => e.payload.ticketId)).toEqual([alreadyLate]);
  });

  it('says nothing about a request that was already answered', async () => {
    const id = await requestDue(-30, -60);
    await ticketService.recordFirstResponse(context.ctx, id, new Date());

    const result = await ticketSlaSweep.sweepTenant(context.ctx);
    expect(result.firstResponseBreached).toBe(0);
  });

  it('says nothing about a request that has been closed', async () => {
    const id = await requestDue(-30, -60);
    const stages = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${context.tenant.tenantId}'`);
      const pipeline = await tx.pipeline.findFirstOrThrow({
        where: { objectKey: 'ticket' },
        include: { stages: { orderBy: { sortOrder: 'asc' } } },
      });
      return pipeline.stages;
    });
    await ticketService.moveStage(context.ctx, id, {
      toStageId: stages.find((s) => s.stageType === 'closed')?.id,
    });

    const result = await ticketSlaSweep.sweepTenant(context.ctx);
    // It was recorded as breached while it was still open; re-reporting it now
    // tells somebody about a deadline they can no longer do anything about.
    expect(result.firstResponseBreached).toBe(0);
  });
});

/* ── The promise itself ─────────────────────────────────────────────────── */

describe('slaPolicyService', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await makeTestContext();
  });

  afterAll(async () => {
    await disposeTestContext(context);
  });

  it('demotes the incumbent when a new default is promoted', async () => {
    const first = await slaPolicyService.create(context.ctx, {
      name: 'Original',
      isDefault: true,
      ...ALWAYS_OPEN,
      targets: [{ priority: 'medium', firstResponseMinutes: 120 }],
    });
    const second = await slaPolicyService.create(context.ctx, {
      name: 'Replacement',
      isDefault: true,
      ...ALWAYS_OPEN,
      targets: [{ priority: 'medium', firstResponseMinutes: 60 }],
    });

    const reread = await slaPolicyService.get(context.ctx, first.id);
    // The partial unique index would otherwise refuse the write with an error
    // nobody could act on.
    expect(reread.isDefault).toBe(false);
    expect(second.isDefault).toBe(true);
  });

  it('replaces targets as a SET, so a promise can be withdrawn', async () => {
    const policy = await slaPolicyService.create(context.ctx, {
      name: 'Withdrawable',
      ...ALWAYS_OPEN,
      targets: [
        { priority: 'low', firstResponseMinutes: 999 },
        { priority: 'high', firstResponseMinutes: 30 },
      ],
    });
    const updated = await slaPolicyService.update(context.ctx, policy.id, {
      targets: [{ priority: 'high', firstResponseMinutes: 30 }],
    });
    // "We no longer promise anything on low priority" is the absence of a row.
    // A merge would make it inexpressible.
    expect(updated.targets.map((t) => t.priority)).toEqual(['high']);
  });

  it('keeps everything else when only the name is patched', async () => {
    const policy = await slaPolicyService.create(context.ctx, {
      name: 'Before',
      timezone: 'America/Denver',
      businessHours: [{ day: 1, startMinute: 540, endMinute: 1020 }],
      holidays: ['2027-01-01'],
      warnAtPercent: 60,
      targets: [{ priority: 'urgent', firstResponseMinutes: 15 }],
    });
    const renamed = await slaPolicyService.update(context.ctx, policy.id, { name: 'After' });

    // The `.default()`-survives-`.partial()` trap: a rename must not reset the
    // timezone to UTC, wipe the hours, or delete every target.
    expect(renamed.name).toBe('After');
    expect(renamed.timezone).toBe('America/Denver');
    expect(renamed.warnAtPercent).toBe(60);
    expect(renamed.targets).toHaveLength(1);
    expect(Array.isArray(renamed.businessHours)).toBe(true);
  });

  it('refuses to archive the only promise for a site', async () => {
    // Its OWN tenant: "the only one" is a statement about the whole set, so a
    // tenant the other tests in this file have already put four policies into
    // cannot express it.
    const solo = await makeTestContext();
    try {
      const only = await slaPolicyService.create(solo.ctx, {
        name: 'The only one',
        isDefault: true,
        ...ALWAYS_OPEN,
        targets: [{ priority: 'medium', firstResponseMinutes: 120 }],
      });
      // Otherwise the next request arrives with nothing attached, silently.
      await expect(slaPolicyService.archive(solo.ctx, only.id)).rejects.toThrow(/only support/i);

      // And it is allowed once there is a replacement to fall back on.
      await slaPolicyService.create(solo.ctx, {
        name: 'A successor',
        ...ALWAYS_OPEN,
        targets: [{ priority: 'medium', firstResponseMinutes: 240 }],
      });
      const archived = await slaPolicyService.archive(solo.ctx, only.id);
      expect(archived.archivedAt).not.toBeNull();
    } finally {
      await disposeTestContext(solo);
    }
  });
});

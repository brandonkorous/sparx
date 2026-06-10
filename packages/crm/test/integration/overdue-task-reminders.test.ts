// Overdue-task reminders — OUTCOME-level coverage (docs/81 §12 Phase 2).
//
// Like the other scheduled CRM behaviors, docs/81 folds this daily sweep into
// the automation engine. The durable contract is "an OPEN task whose due date
// has passed produces a reminder signal for its assignee; a future or
// already-closed task does not." We assert the emitted signal (captured via the
// RecordingPublisher), not the scheduler's return count, so the suite survives
// the cron -> engine swap.

import crypto from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { withTenant } from '@sparx/db';

import { taskService } from '../../src/services/index.js';
import { emitOverdueTaskReminders } from '../../src/schedulers/overdue-task-reminders';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

const DAY = 86_400_000;

describe('overdue task reminders (outcome-level)', () => {
  let t: TestContext;

  beforeAll(async () => {
    t = await makeTestContext('owner');
  });

  afterAll(async () => {
    await disposeTestContext(t);
  });

  beforeEach(() => {
    t.publisher.clear();
  });

  // Create an open task due `dueDaysFromNow` days from now (negative = overdue),
  // assigned to the tenant's own staff user.
  async function task(dueDaysFromNow: number): Promise<string> {
    const created = await taskService.create(t.ctx, {
      title: `Task ${crypto.randomBytes(3).toString('hex')}`,
      assignedToUserId: t.tenant.userId,
      dueAt: new Date(Date.now() + dueDaysFromNow * DAY).toISOString(),
    });
    return created.id;
  }

  function remindedTaskIds(): string[] {
    return t.publisher.events
      .filter((e) => (e.payload as { reason?: string }).reason === 'overdue_reminder')
      .map((e) => (e.payload as { taskId: string }).taskId);
  }

  it('reminds on a past-due open task, not a future one', async () => {
    const overdue = await task(-5);
    const future = await task(5);

    const count = await emitOverdueTaskReminders(t.ctx);

    const reminded = remindedTaskIds();
    expect(reminded).toContain(overdue);
    expect(reminded).not.toContain(future);

    // The signal carries the elapsed-days fact the reminder template keys on.
    const signal = t.publisher.events.find(
      (e) =>
        (e.payload as { reason?: string }).reason === 'overdue_reminder' &&
        (e.payload as { taskId?: string }).taskId === overdue
    );
    expect(signal).toBeDefined();
    expect((signal!.payload as { daysOverdue: number }).daysOverdue).toBeGreaterThanOrEqual(4);

    // Loose sanity only — the count is the scheduler's internal return shape.
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('stops reminding once the task is no longer open', async () => {
    const id = await task(-10);
    // Close it — however overdue, a completed task must not be reminded.
    await withTenant(t.ctx, (tx) =>
      tx.task.update({ where: { id }, data: { status: 'completed' } })
    );

    await emitOverdueTaskReminders(t.ctx);
    expect(remindedTaskIds()).not.toContain(id);
  });

  it('emits each reminder at most once per day (idempotent re-runs)', async () => {
    const id = await task(-3);

    // Two ticks on the same calendar day must collapse to one delivered signal:
    // the dedupeKey is date-stamped. Assert the OUTCOME a consumer sees.
    await emitOverdueTaskReminders(t.ctx);
    await emitOverdueTaskReminders(t.ctx);

    const occurrences = t.publisher.events.filter(
      (e) =>
        (e.payload as { reason?: string }).reason === 'overdue_reminder' &&
        (e.payload as { taskId?: string }).taskId === id
    );
    const keys = new Set(occurrences.map((e) => e.dedupeKey));
    expect(keys.size).toBe(1);
  });
});

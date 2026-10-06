// What the search box says under a task.
//
// MEASURED 2026-10-06 on Gillett Diesel Service: "Order O-000012 from Dana
// Whitcomb-Nguyen is waiting for your sign-off" was done, its order signed off
// and placed, and the search box still listed it under Tasks as "Medium
// priority". Its title says it is waiting, and nothing beside it said otherwise.
// The line under a closed task now says it is closed, in the task list's words.

import { describe, expect, it, vi } from 'vitest';

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
}

let row: TaskRow | null = null;

const tx = {
  task: {
    findFirst: () => Promise.resolve(row),
  },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));

const { commerceUniversalProjectors } = await import('./universal-projection');

const projector = commerceUniversalProjectors.find((p) => p.entityType === 'task');

function task(status: string): TaskRow {
  return {
    id: 't-12',
    title:
      'Order O-000012 from Dana Whitcomb-Nguyen is waiting for your sign-off: approve or reject it under Approvals',
    description: 'Order O-000012 was signed off and placed.',
    status,
    priority: 'medium',
    createdAt: new Date('2026-10-02T21:49:09Z'),
    updatedAt: new Date('2026-10-06T08:20:00Z'),
  };
}

async function line(status: string): Promise<string | undefined> {
  if (!projector) throw new Error('no task projector');
  row = task(status);
  const doc = await projector.project({ tenantId: 'tenant-gillett' }, 't-12');
  return doc?.subtitle;
}

describe('the line under a task in the search box', () => {
  it('says how urgent it is while it is open', async () => {
    expect(await line('open')).toBe('Medium priority');
  });

  it('says it is done once it is', async () => {
    expect(await line('completed')).toBe('Done');
  });

  it('says it was canceled once it was', async () => {
    expect(await line('cancelled')).toBe('Canceled');
  });
});

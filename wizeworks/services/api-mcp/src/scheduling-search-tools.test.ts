// A Bookings record an AI assistant sets up is findable by name at once
// (persona issue 261): the REST routes signaled search and these tools did not.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const indexEntity = vi.fn(() => Promise.resolve());
let person: { id: string } | null = null;

vi.mock('@wizeworks/events', () => ({ indexEntity }));
vi.mock('@wizeworks/db', () => ({
  withTenant: (_ctx: unknown, fn: (tx: unknown) => unknown) =>
    Promise.resolve(fn({ staffMember: { findFirst: () => Promise.resolve(person) } })),
}));

const { withSchedulingSearch } = await import('./scheduling-search-tools.js');

const ctx = { tenantId: 'tenant-1', userId: 'user-1' };

function tool(name: string, result: unknown) {
  return {
    name,
    description: '',
    scope: 'write:scheduling',
    input: {} as never,
    confirmation: true,
    run: vi.fn((_ctx: unknown, _input: unknown) => Promise.resolve(result)),
  };
}

beforeEach(() => {
  indexEntity.mockClear();
  person = null;
});

describe('the Bookings tools an assistant calls', () => {
  it('tell search about a service they made', async () => {
    const [wrapped] = withSchedulingSearch([
      tool('create_scheduling_service', { id: 'svc-1', name: 'Haircut' }),
    ]);
    await wrapped!.run(ctx, { name: 'Haircut' });
    expect(indexEntity).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      actorId: 'user-1',
      entityType: 'scheduling_service',
      recordId: 'svc-1',
    });
  });

  it('tell search about the person behind a staff resource too', async () => {
    person = { id: 'person-9' };
    const [wrapped] = withSchedulingSearch([
      tool('update_scheduling_resource', { id: 'res-1', name: 'Ines' }),
    ]);
    await wrapped!.run(ctx, { id: 'res-1', name: 'Ines' });
    expect(indexEntity.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      expect.objectContaining({ entityType: 'scheduling_resource', recordId: 'res-1' }),
      expect.objectContaining({ entityType: 'staff_member', recordId: 'person-9' }),
    ]);
  });

  it('read a removed booking rule from what was asked', async () => {
    const [wrapped] = withSchedulingSearch([tool('delete_booking_policy', undefined)]);
    await wrapped!.run(ctx, { policyId: 'pol-3' });
    expect(indexEntity).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'booking_policy', recordId: 'pol-3' })
    );
  });

  it('leave a tool that writes nothing searchable alone', () => {
    const original = tool('create_booking', { id: 'bk-1' });
    const [wrapped] = withSchedulingSearch([original]);
    expect(wrapped).toBe(original);
  });
});

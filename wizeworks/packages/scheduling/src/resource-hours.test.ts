import { describe, expect, it, vi } from 'vitest';

/**
 * WHICH PEOPLE OR THINGS HAVE ANY WEEKLY HOURS (sparx persona issue 118).
 *
 * A new one starts with none and can never be booked. The console shows "No
 * hours" from this set; an empty answer for a list of ids asks the database
 * nothing.
 */

const TENANT = '5944fe23-be83-4ce5-aafc-ef56b8594508';
const BAY = 'df3a3a04-9f43-4b13-9b04-850988823f2b';
const DYNO = '87bd79a1-152b-44de-9ec0-c6485f02903f';

const findMany = vi.fn(() => Promise.resolve([{ resourceId: BAY }]));
const tx = { availabilityWindow: { findMany } };

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => fn(tx),
}));

const { resourcesWithWeeklyHours } = await import('./resources');

describe('resourcesWithWeeklyHours', () => {
  it('names the ones with hours and leaves out the ones without', async () => {
    const withHours = await resourcesWithWeeklyHours(TENANT, [BAY, DYNO]);
    expect(withHours.has(BAY)).toBe(true);
    expect(withHours.has(DYNO)).toBe(false);
    expect(findMany).toHaveBeenCalledWith({
      where: { resourceId: { in: [BAY, DYNO] } },
      select: { resourceId: true },
      distinct: ['resourceId'],
    });
  });

  it('asks nothing for no ids', async () => {
    findMany.mockClear();
    expect((await resourcesWithWeeklyHours(TENANT, [])).size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });
});

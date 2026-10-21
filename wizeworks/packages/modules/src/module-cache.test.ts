// One page, one tenant read.
//
// The module cache was keyed per (tenant, module), so a storefront render that
// asked about builder, commerce, scheduling and cms read the SAME `tenants` row
// four times, and asked at once, all four missed together. On a site that is
// visited less than once a minute every render is cold, which is most of them:
// WizeLens counted 565 repeated tenant reads across 89 requests in a day.
//
// Mocked at the client, because the defect is the number of reads, not their SQL.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUnique = vi.fn();
vi.mock('@wizeworks/db', () => ({ prisma: { tenant: { findUnique } } }));

const { activeModules, invalidateModuleCache, isModuleEnabled } = await import('./index');

const TENANT = 'tenant-1';

beforeEach(() => {
  invalidateModuleCache();
  findUnique.mockReset();
  findUnique.mockResolvedValue({
    settings: { modules: { commerce: { enabled: true }, cms: { enabled: true } } },
  });
});

describe('isModuleEnabled', () => {
  it('reads the tenant once for every module a page asks about at once', async () => {
    const answers = await Promise.all([
      isModuleEnabled(TENANT, 'builder'),
      isModuleEnabled(TENANT, 'commerce'),
      isModuleEnabled(TENANT, 'scheduling'),
      isModuleEnabled(TENANT, 'cms'),
    ]);
    expect(answers).toEqual([false, true, false, true]);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('answers a later question from the same read', async () => {
    await isModuleEnabled(TENANT, 'commerce');
    await isModuleEnabled(TENANT, 'cms');
    await activeModules(TENANT);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('reads again after the module switches, so a change shows at once', async () => {
    expect(await isModuleEnabled(TENANT, 'scheduling')).toBe(false);
    findUnique.mockResolvedValue({ settings: { modules: { scheduling: { enabled: true } } } });
    invalidateModuleCache(TENANT, 'scheduling');
    expect(await isModuleEnabled(TENANT, 'scheduling')).toBe(true);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('does not keep a failed read, so one database blip is not served for a minute', async () => {
    findUnique.mockRejectedValueOnce(new Error('pool timeout'));
    await expect(isModuleEnabled(TENANT, 'commerce')).rejects.toThrow('pool timeout');
    expect(await isModuleEnabled(TENANT, 'commerce')).toBe(true);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('keeps tenants apart', async () => {
    await isModuleEnabled(TENANT, 'commerce');
    await isModuleEnabled('tenant-2', 'commerce');
    expect(findUnique).toHaveBeenCalledTimes(2);
  });
});

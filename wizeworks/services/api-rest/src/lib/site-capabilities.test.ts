// Whether a site's visitors have accounts there, asked of THIS site (persona issue 947).
// An account that sells on one site and publishes a journal on another switches the
// shop off on the journal: its readers have nothing to sign in to.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const moduleStates = new Map<string, boolean>();
let siteOff: string[] | Error = [];

vi.mock('@wizeworks/auth', () => ({
  isModuleEnabled: (_tenantId: string, key: string) =>
    Promise.resolve(moduleStates.get(key) ?? false),
}));
vi.mock('./property.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  siteDisabledModules: () =>
    siteOff instanceof Error ? Promise.reject(siteOff) : Promise.resolve(siteOff),
}));

const { siteCapabilities } = await import('./site-check.js');

const CTX = {
  tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  propertyId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  userId: undefined,
};

beforeEach(() => {
  moduleStates.clear();
  siteOff = [];
});

describe('siteCapabilities', () => {
  it('says a shop has customer accounts', async () => {
    moduleStates.set('commerce', true);
    expect(await siteCapabilities(CTX)).toEqual({ customerAccounts: true });
  });

  it('says a journal that switched the shop and bookings off has none', async () => {
    moduleStates.set('commerce', true);
    moduleStates.set('scheduling', true);
    siteOff = ['commerce', 'scheduling', 'b2b'];
    expect(await siteCapabilities(CTX)).toEqual({ customerAccounts: false });
  });

  it('claims nothing when it could not read the site’s switches', async () => {
    moduleStates.set('commerce', true);
    siteOff = new Error('blip');
    expect(await siteCapabilities(CTX)).toEqual({});
  });
});

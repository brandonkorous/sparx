import { beforeEach, describe, expect, it, vi } from 'vitest';

// Every read the account home makes, held open so the test decides when each one answers.
const reads = vi.hoisted(() => ({
  tenant: vi.fn(),
  domain: vi.fn(),
  billing: vi.fn(),
  consent: vi.fn(),
  capacity: vi.fn(),
}));

vi.mock('@wizeworks/db', () => ({
  prisma: { tenant: { findUnique: reads.tenant }, domain: { findFirst: reads.domain } },
}));
vi.mock('@wizeworks/usage', () => ({ capacityReport: reads.capacity }));
vi.mock('./billing', () => ({ readBilling: reads.billing }));
vi.mock('./consent', () => ({ readConsent: reads.consent }));

import { loadAccountHome } from './account-load';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const user = { id: 'u1', tenantId: 't1', homeTenantId: 'home1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadAccountHome', () => {
  it('starts the consent read before the tenant and billing reads answer', async () => {
    const tenant = deferred<{ platformBrand: string }>();
    reads.tenant.mockReturnValue(tenant.promise);
    reads.domain.mockResolvedValue({ host: 'dana.piggles.site' });
    reads.billing.mockReturnValue(new Promise(() => undefined));
    reads.consent.mockResolvedValue(null);

    void loadAccountHome(user);
    await flush();
    expect(reads.consent).toHaveBeenCalledWith('u1', 'home1');
  });

  it('starts capacity as soon as the tenant answers, without waiting on billing', async () => {
    const tenant = deferred<{ platformBrand: string }>();
    reads.tenant.mockReturnValue(tenant.promise);
    reads.domain.mockResolvedValue(null);
    reads.billing.mockReturnValue(new Promise(() => undefined));
    reads.consent.mockResolvedValue(null);

    void loadAccountHome(user);
    tenant.resolve({ platformBrand: 'piggles' });
    await flush();
    expect(reads.capacity).toHaveBeenCalledWith('t1', 'piggles');
    expect(reads.tenant).toHaveBeenCalledTimes(1);
  });

  it('returns every read', async () => {
    reads.tenant.mockResolvedValue({ name: 'Dana', platformBrand: 'piggles' });
    reads.domain.mockResolvedValue({ host: 'dana.piggles.site' });
    reads.billing.mockResolvedValue({ subscribed: true });
    reads.consent.mockResolvedValue({ analytics: true, at: '' });
    reads.capacity.mockResolvedValue({ meters: [], measuredAt: null });

    const home = await loadAccountHome(user);
    expect(home.tenant?.name).toBe('Dana');
    expect(home.siteAddress?.host).toBe('dana.piggles.site');
    expect(home.consent).toEqual({ analytics: true, at: '' });
    expect(home.capacity).toEqual({ meters: [], measuredAt: null });
  });
});

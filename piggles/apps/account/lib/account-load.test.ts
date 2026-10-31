import { beforeEach, describe, expect, it, vi } from 'vitest';

// Every read the account home makes is a call to api-rest, held open here so
// the test decides when each one answers.
const calls = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@wizeworks/auth-client-server', () => {
  class PlatformRequestError extends Error {
    constructor(
      readonly path: string,
      readonly status: number | null
    ) {
      super(path);
    }
  }
  return { platformRequest: calls.request, PlatformRequestError };
});

import { PlatformRequestError } from '@wizeworks/auth-client-server';
import { capacityFromWire, loadAccountHome, readBusiness } from './account-load';

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadAccountHome', () => {
  it('asks for all four at once, without waiting on any of them', async () => {
    calls.request.mockReturnValue(new Promise(() => undefined));
    void loadAccountHome();
    await flush();
    expect(calls.request.mock.calls.map(([path]) => path as string).sort()).toEqual([
      'business',
      'business/billing',
      'business/capacity',
      'consent',
    ]);
  });

  it('returns every read, with the trial end as a date', async () => {
    calls.request.mockImplementation((path: string) => {
      switch (path) {
        case 'business':
          return Promise.resolve({
            business: {
              name: 'Dana',
              slug: 'dana',
              subscriptionStatus: 'trialing',
              trialEndsAt: '2026-11-12T00:00:00.000Z',
              siteHost: 'dana.piggles.site',
              modulesEnabled: [],
              brandSettings: {},
            },
          });
        case 'business/billing':
          return Promise.resolve({ billing: { subscribed: true } });
        case 'consent':
          return Promise.resolve({ consent: { analytics: true, at: '' } });
        default:
          return Promise.resolve({
            capacity: { meters: [], measuredAt: null, allowanceSource: 'none' },
          });
      }
    });

    const home = await loadAccountHome();
    expect(home.business?.name).toBe('Dana');
    expect(home.business?.trialEndsAt?.toISOString()).toBe('2026-11-12T00:00:00.000Z');
    expect(home.business?.siteHost).toBe('dana.piggles.site');
    expect(home.billing).toEqual({ subscribed: true });
    expect(home.consent).toEqual({ analytics: true, at: '' });
    expect(home.capacity.measuredAt).toBeNull();
  });
});

describe('readBusiness', () => {
  it('reads a business that no longer exists as none', async () => {
    calls.request.mockRejectedValue(new PlatformRequestError('/platform/business', 404));
    await expect(readBusiness()).resolves.toBeNull();
  });

  it('does not read a failed call as "no business"', async () => {
    calls.request.mockRejectedValue(new PlatformRequestError('/platform/business', 503));
    await expect(readBusiness()).rejects.toThrow();
  });
});

describe('capacityFromWire', () => {
  it('turns byte counts back into bigints and keeps "not measured" as null', () => {
    const report = capacityFromWire({
      meters: [
        { meter: 'storage', used: '9007199254740993', limit: '10', fraction: 0.5, state: 'ok' },
        { meter: 'customers', used: null, limit: null, fraction: null, state: 'unmetered' },
      ] as never,
      measuredAt: '2026-10-29T00:00:00.000Z',
      allowanceSource: 'configured',
    });
    expect(report.meters[0]?.used).toBe(9007199254740993n);
    expect(report.meters[1]?.used).toBeNull();
    expect(report.measuredAt).toEqual(new Date('2026-10-29T00:00:00.000Z'));
  });
});

// The internal cron guard and its per-tenant sweep.
//
// Both are small, and both are the kind of small where being wrong is expensive:
// the guard is the only thing in front of endpoints that mutate every tenant on
// the platform, and the sweep is what decides whether one bad tenant costs the
// other forty-eight their nightly run.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { env } = vi.hoisted(() => ({
  env: { SPARX_INTERNAL_CRON_TOKEN: undefined as string | undefined },
}));
vi.mock('../env.js', () => ({ env }));

const { authorizeCron, forEachTenant } = await import('./cron-auth.js');

const TOKEN = 'a-token-at-least-16-chars';

function request(header?: string) {
  return {
    headers: header === undefined ? {} : { 'x-sparx-internal-cron-token': header },
  } as never;
}

beforeEach(() => {
  env.SPARX_INTERNAL_CRON_TOKEN = TOKEN;
});

describe('authorizeCron', () => {
  it('accepts the configured token', () => {
    expect(() => {
      authorizeCron(request(TOKEN));
    }).not.toThrow();
  });

  it('REFUSES when no token is configured, rather than waving everything through', () => {
    // The dangerous default. An unset secret in production has to close the
    // endpoint, not open it — "not configured" must never read as "no auth
    // required" on a route that can write to every tenant.
    env.SPARX_INTERNAL_CRON_TOKEN = undefined;
    expect(() => {
      authorizeCron(request(TOKEN));
    }).toThrow(/not configured/);
  });

  it('rejects a missing, empty, wrong or differently-sized token', () => {
    for (const bad of [undefined, '', 'wrong', `${TOKEN}x`, TOKEN.slice(0, -1)]) {
      expect(() => {
        authorizeCron(request(bad));
      }).toThrow();
    }
  });

  it('answers 401, not 500', () => {
    try {
      authorizeCron(request('wrong'));
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as { statusCode?: number }).statusCode).toBe(401);
      expect((error as { code?: string }).code).toBe('UNAUTHORIZED');
    }
  });
});

describe('forEachTenant', () => {
  const tenants = [
    { id: 'a', slug: 'alpha' },
    { id: 'b', slug: 'bravo' },
    { id: 'c', slug: 'charlie' },
  ];

  it('runs every tenant and reports each result', async () => {
    const summary = await forEachTenant(tenants, (id) => Promise.resolve({ id }));
    expect(summary).toMatchObject({ tenants: 3, ok: 3, failed: 0 });
    expect(summary.outcomes.map((o) => o.slug)).toEqual(['alpha', 'bravo', 'charlie']);
  });

  it('keeps going after a failure — one bad tenant must not end the night', async () => {
    // The whole reason this helper exists. A sweep that threw on the first bad
    // row would leave every tenant after it unprocessed until someone noticed,
    // and nightly jobs are precisely what nobody is watching.
    const seen: string[] = [];
    const summary = await forEachTenant(tenants, (id) => {
      seen.push(id);
      return id === 'b' ? Promise.reject(new Error('boom')) : Promise.resolve({ id });
    });

    expect(seen).toEqual(['a', 'b', 'c']);
    expect(summary).toMatchObject({ tenants: 3, ok: 2, failed: 1 });
    expect(summary.outcomes[1]).toMatchObject({ slug: 'bravo', ok: false, error: 'boom' });
  });

  it('records a non-Error rejection rather than losing it', async () => {
    // A thrown string is not good practice, and it is exactly what a third-party
    // client library does at 3am — the sweep has to keep the text either way.
    const summary = await forEachTenant([{ id: 'a', slug: 'alpha' }], () =>
      Promise.resolve().then(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- deliberately not an Error; that IS the case under test.
        throw 'just a string';
      })
    );
    expect(summary.outcomes[0]).toMatchObject({ ok: false, error: 'just a string' });
  });

  it('is sequential, so a sweep cannot storm the shared connection pool', async () => {
    let concurrent = 0;
    let peak = 0;
    await forEachTenant(tenants, async () => {
      concurrent += 1;
      peak = Math.max(peak, concurrent);
      await Promise.resolve();
      concurrent -= 1;
      return null;
    });
    expect(peak).toBe(1);
  });
});

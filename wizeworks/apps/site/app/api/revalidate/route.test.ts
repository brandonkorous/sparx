// The purge must EXPIRE what it names. Marking entries stale kept serving them, and
// because Next stores only a 200, a page the owner deleted (now a 404) was served on
// and on (persona issue 947).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: [string, unknown][] = [];
vi.mock('next/cache', () => ({
  revalidateTag: (tag: string, profile: unknown) => {
    calls.push([tag, profile]);
  },
}));

process.env.SPARX_REVALIDATE_SECRET = 'test-secret';
const { POST } = await import('./route');

function request(body: unknown) {
  return {
    headers: new Headers({ 'x-revalidate-secret': 'test-secret' }),
    json: () => Promise.resolve(body),
  } as never;
}

describe('POST /api/revalidate', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('expires every tag it purges, so a deleted page is not served from the cache', async () => {
    const res = await POST(request({ tenant: 'the-marrow-review', scopes: ['builder'] }));
    expect(res.status).toBe(200);
    expect(calls).toEqual([
      ['tenant:the-marrow-review', { expire: 0 }],
      ['builder:the-marrow-review', { expire: 0 }],
    ]);
  });
});

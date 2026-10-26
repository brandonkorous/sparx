import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_TIMEOUT_MS } from './api-origin';
import { fetchHeaderNotice } from './notice';
import { fetchFounderOffer, resolveHeaderNotice } from './pricing';

// api-rest that never answers: the fetch settles only when its signal aborts.
function hangingFetch() {
  return vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })
  );
}

function answer(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('header notice reads with api-rest hung', () => {
  it('fetchHeaderNotice gives up with null after the timeout', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const started = Date.now();
    await expect(fetchHeaderNotice('account')).resolves.toBeNull();
    expect(Date.now() - started).toBeLessThan(API_TIMEOUT_MS + 1000);
  });

  it('fetchFounderOffer gives up with null after the timeout', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    await expect(fetchFounderOffer()).resolves.toBeNull();
  });

  it('resolveHeaderNotice runs both reads at once and returns null', async () => {
    const fetch = hangingFetch();
    vi.stubGlobal('fetch', fetch);
    const started = Date.now();
    const pending = resolveHeaderNotice('marketing', '/pricing#founding');
    expect(fetch).toHaveBeenCalledTimes(2);
    await expect(pending).resolves.toBeNull();
    expect(Date.now() - started).toBeLessThan(2 * API_TIMEOUT_MS);
  });
});

describe('resolveHeaderNotice', () => {
  it("prefers staff's notice over the offer", async () => {
    const announcement = { id: 'n1', message: 'Hi', linkLabel: null, linkHref: null };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.includes('announcements')
          ? answer({
              data: { announcement: { ...announcement, tone: 'info', dismissible: false } },
            })
          : answer({ data: { offer: { amountOffCents: 2000, limit: 100, remaining: 5 } } })
      )
    );
    const notice = await resolveHeaderNotice('account', '/pricing');
    expect(notice?.id).toBe('n1');
  });

  it('falls back to the founding offer while places are left', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.includes('announcements')
          ? answer({ data: { announcement: null } })
          : answer({ data: { offer: { amountOffCents: 2000, limit: 100, remaining: 5 } } })
      )
    );
    const notice = await resolveHeaderNotice('account', '/pricing');
    expect(notice?.id).toBe('founding-offer');
    expect(notice?.linkHref).toBe('/pricing');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { GET, POST } from '../app/api/sparx/[...path]/route';
import { isCheckoutUnreachable, startCheckout } from './checkout-client';
import { AccountError, getMe, isShopUnreachable, readSession } from './customer-client';
import {
  accountGate,
  cartReadOutcome,
  retryDelayMs,
  SHOP_UNREACHABLE_CODE,
  SHOP_UNREACHABLE_MESSAGE,
  statusAfterUnansweredRead,
} from './shop-reach';

/**
 * COULD NOT CHECK IS NOT SIGNED OUT (sparx persona issue 086).
 *
 * A trade buyer opened her account's orders while api-rest was restarting. The
 * proxy's fetch threw, Next answered a bare 500 with no body, the account read
 * turned that into "Something went wrong", and the provider read ANY failure as
 * "nobody is signed in", so the account area sent her to the sign-in page. Her
 * session was fine and a reload a minute later showed her pages again.
 *
 * Three places had to learn the difference: the proxy (say "try again" in a way
 * a client can recognize), the session read (an unanswered question is not a
 * "no"), and the screens that act on the answer (wait and retry, never redirect).
 */

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function envelope(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function proxied(path: string[], method = 'GET') {
  const request = new NextRequest(`http://shop.test/api/sparx/${path.join('/')}?tenant=juniper`, {
    method,
    headers: { cookie: 'sparx_customer_session=abc' },
  });
  return { request, ctx: { params: Promise.resolve({ path }) } };
}

describe('the /api/sparx proxy when api-rest cannot be reached', () => {
  it('answers 503 with a JSON body a client can recognize, not a bare 500', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const { request, ctx } = proxied(['v1', 'public', 'commerce', 'account', 'me']);

    const res = await GET(request, ctx);

    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).not.toBeNull();
    const body = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(SHOP_UNREACHABLE_CODE);
    expect(body.error.message).toBe(SHOP_UNREACHABLE_MESSAGE);
  });

  it('does the same for a write, so a checkout step fails in the same words', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const { request, ctx } = proxied(['v1', 'public', 'commerce', 'checkout'], 'POST');

    const res = await POST(request, ctx);

    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      SHOP_UNREACHABLE_CODE
    );
  });

  it('turns a gateway error page in front of api-rest into the same answer', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>502 Bad Gateway</html>', {
        status: 502,
        headers: { 'content-type': 'text/html' },
      })
    );
    const { request, ctx } = proxied(['v1', 'public', 'commerce', 'account', 'me']);

    const res = await GET(request, ctx);

    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      SHOP_UNREACHABLE_CODE
    );
  });

  it('still relays a real 401 untouched, which is what signs somebody out', async () => {
    fetchMock.mockResolvedValue(
      envelope(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'Sign in.' } })
    );
    const { request, ctx } = proxied(['v1', 'public', 'commerce', 'account', 'me']);

    const res = await GET(request, ctx);

    expect(res.status).toBe(401);
  });

  it('still relays api-rest’s own JSON 503, which carries its own words', async () => {
    fetchMock.mockResolvedValue(
      envelope(503, {
        success: false,
        error: { code: 'PAYMENTS_DOWN', message: 'Card payments are paused.' },
      })
    );
    const { request, ctx } = proxied(['v1', 'public', 'commerce', 'checkout']);

    const res = await GET(request, ctx);

    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('PAYMENTS_DOWN');
  });
});

describe('reading the signed-in shopper', () => {
  it('a 401 is a real "nobody is signed in"', async () => {
    fetchMock.mockResolvedValue(envelope(401, { success: false, error: { code: 'UNAUTHORIZED' } }));

    expect(await readSession('juniper')).toEqual({ kind: 'signed-out' });
    expect(await getMe('juniper')).toBeNull();
  });

  it('the old proxy’s bare 500 is "could not check", never "signed out"', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 500 })));

    const err = await getMe('juniper').catch((e: unknown) => e);
    expect((err as Error).message).toBe(SHOP_UNREACHABLE_MESSAGE);
    expect(isShopUnreachable(err)).toBe(true);
    expect(await readSession('juniper')).toEqual({ kind: 'unreachable' });
  });

  it('the proxy’s 503 is "could not check"', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        envelope(503, {
          success: false,
          error: { code: SHOP_UNREACHABLE_CODE, message: SHOP_UNREACHABLE_MESSAGE },
        })
      )
    );

    expect(await readSession('juniper')).toEqual({ kind: 'unreachable' });
  });

  it('a network failure is "could not check"', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await readSession('juniper')).toEqual({ kind: 'unreachable' });
  });

  it('a 200 is the shopper', async () => {
    fetchMock.mockResolvedValue(
      envelope(200, {
        success: true,
        data: { customer: { id: 'c1', email: 'renee@example.com' }, offers: { b2b: true } },
      })
    );

    const read = await readSession('juniper');
    expect(read.kind).toBe('signed-in');
  });

  it('a refused request that is not a blip is not dressed up as one', () => {
    expect(isShopUnreachable(new AccountError('That email is already in use.', 409))).toBe(false);
    expect(isShopUnreachable(new AccountError(SHOP_UNREACHABLE_MESSAGE, 503))).toBe(true);
  });
});

describe('what an unanswered session read leaves behind', () => {
  it('a page that was still asking keeps asking, and says so', () => {
    expect(statusAfterUnansweredRead('loading')).toBe('unreachable');
    expect(statusAfterUnansweredRead('unreachable')).toBe('unreachable');
  });

  it('somebody already known to be signed in stays signed in', () => {
    expect(statusAfterUnansweredRead('authenticated')).toBe('authenticated');
  });

  it('somebody already known to be signed out stays signed out', () => {
    expect(statusAfterUnansweredRead('anonymous')).toBe('anonymous');
  });
});

describe('the account area’s guard', () => {
  it('sends a signed-out visitor to sign in', () => {
    expect(accountGate('anonymous', false)).toBe('sign-in');
  });

  it('never sends somebody to sign in because the shop could not be reached', () => {
    expect(accountGate('unreachable', false)).toBe('retrying');
  });

  it('waits while the first read is out, and shows the page once it answers', () => {
    expect(accountGate('loading', false)).toBe('wait');
    expect(accountGate('authenticated', true)).toBe('show');
  });

  it('tries again soon, then backs off without giving up', () => {
    expect(retryDelayMs(0)).toBeLessThanOrEqual(3000);
    expect(retryDelayMs(1)).toBeGreaterThan(retryDelayMs(0));
    expect(retryDelayMs(50)).toBeLessThanOrEqual(30000);
    expect(retryDelayMs(50)).toBeGreaterThan(0);
  });
});

describe('reading the cart', () => {
  it('a blip is retried, not shown as an empty cart', () => {
    expect(cartReadOutcome(503)).toBe('retry');
    expect(cartReadOutcome(500)).toBe('retry');
    expect(cartReadOutcome(0)).toBe('retry');
  });

  it('a cart that is gone is forgotten', () => {
    expect(cartReadOutcome(404)).toBe('gone');
    expect(cartReadOutcome(403)).toBe('gone');
  });

  it('a cart that was already bought is forgotten (sparx persona issue 087)', () => {
    expect(cartReadOutcome(410)).toBe('gone');
  });

  it('a cart that answers is used', () => {
    expect(cartReadOutcome(200)).toBe('loaded');
  });
});

describe('checkout steps when the shop cannot be reached', () => {
  it('say the shop could not be reached, not "Request failed (502)"', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>502 Bad Gateway</html>', {
        status: 502,
        headers: { 'content-type': 'text/html' },
      })
    );

    await expect(startCheckout('juniper', 'cart_1')).rejects.toThrow(SHOP_UNREACHABLE_MESSAGE);
  });

  it('say the same when the request never left the browser', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(startCheckout('juniper', 'cart_1')).rejects.toThrow(SHOP_UNREACHABLE_MESSAGE);
  });

  it('keep the shop’s own words when it refused for a reason', async () => {
    fetchMock.mockResolvedValue(
      envelope(409, { success: false, error: { code: 'CONFLICT', message: 'That item sold out.' } })
    );

    await expect(startCheckout('juniper', 'cart_1')).rejects.toThrow('That item sold out.');
  });

  it('tell checkout which failures to wait out and which to show and stop at', async () => {
    fetchMock.mockResolvedValue(
      envelope(503, {
        success: false,
        error: { code: SHOP_UNREACHABLE_CODE, message: SHOP_UNREACHABLE_MESSAGE },
      })
    );
    expect(
      isCheckoutUnreachable(await startCheckout('juniper', 'c').catch((e: unknown) => e))
    ).toBe(true);

    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(
      isCheckoutUnreachable(await startCheckout('juniper', 'c').catch((e: unknown) => e))
    ).toBe(true);

    fetchMock.mockResolvedValue(
      envelope(409, { success: false, error: { code: 'CONFLICT', message: 'That item sold out.' } })
    );
    expect(
      isCheckoutUnreachable(await startCheckout('juniper', 'c').catch((e: unknown) => e))
    ).toBe(false);
  });
});

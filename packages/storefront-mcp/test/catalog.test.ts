import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  STOREFRONT_TOOLS,
  getStorefrontTool,
  toolsForModules,
  toAnthropicTools,
  StorefrontApiClient,
  StorefrontApiError,
} from '../src/index.js';

describe('catalog integrity', () => {
  it('has unique tool names', () => {
    const names = STOREFRONT_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every tool has an object input schema and a valid kind', () => {
    for (const t of STOREFRONT_TOOLS) {
      expect(t.input).toBeInstanceOf(z.ZodObject);
      expect(['read', 'guest_write', 'customer']).toContain(t.kind);
      expect(t.description.length).toBeGreaterThan(10);
    }
  });

  it('exposes the load-bearing shopper tools', () => {
    for (const name of [
      'search_products',
      'check_availability',
      'book_appointment',
      'add_to_cart',
    ]) {
      expect(getStorefrontTool(name)).toBeDefined();
    }
  });

  it('toAnthropicTools emits object JSON schemas', () => {
    const defs = toAnthropicTools(STOREFRONT_TOOLS);
    expect(defs.length).toBe(STOREFRONT_TOOLS.length);
    for (const d of defs) expect((d.input_schema as { type?: string }).type).toBe('object');
  });

  it('toolsForModules drops tools for a disabled module', () => {
    const withoutScheduling = toolsForModules(['scheduling']);
    expect(withoutScheduling.some((t) => t.name === 'book_appointment')).toBe(false);
    expect(withoutScheduling.some((t) => t.name === 'search_products')).toBe(true);
    expect(withoutScheduling.some((t) => t.name === 'get_store_info')).toBe(true); // no module
  });
});

describe('StorefrontApiClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(body: unknown, status = 200) {
    const spy = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
    vi.stubGlobal('fetch', spy);
    return spy;
  }

  it('injects tenant/property + relays the cart token and unwraps data', async () => {
    const spy = stubFetch({ success: true, data: { ok: 1 }, meta: { total: 3 } });
    const client = new StorefrontApiClient('http://api-rest', {
      tenantSlug: 'daisy',
      propertySlug: 'salon',
    });
    const res = await client.request({
      method: 'GET',
      path: '/v1/public/commerce/cart/abc',
      cartToken: 'tok_123',
    });
    expect(res.data).toEqual({ ok: 1 });
    expect(res.meta).toEqual({ total: 3 });
    const [url, init] = spy.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.toString()).toContain('tenant=daisy');
    expect(url.toString()).toContain('property=salon');
    expect((init.headers as Record<string, string>)['x-cart-token']).toBe('tok_123');
  });

  it('throws StorefrontApiError with the platform code on a failure envelope', async () => {
    stubFetch({ success: false, error: { code: 'MODULE_DISABLED', message: 'off' } }, 404);
    const client = new StorefrontApiClient('http://api-rest', { tenantSlug: 'daisy' });
    await expect(
      client.request({ method: 'GET', path: '/v1/public/scheduling/services' })
    ).rejects.toMatchObject({
      name: 'StorefrontApiError',
      status: 404,
      code: 'MODULE_DISABLED',
    });
  });

  it('surfaces an unreachable upstream distinctly', async () => {
    const spy = vi.fn(() => Promise.reject(new Error('ECONNREFUSED')));
    vi.stubGlobal('fetch', spy);
    const client = new StorefrontApiClient('http://api-rest', { tenantSlug: 'daisy' });
    await expect(
      client.request({ method: 'GET', path: '/v1/public/search' })
    ).rejects.toBeInstanceOf(StorefrontApiError);
  });
});

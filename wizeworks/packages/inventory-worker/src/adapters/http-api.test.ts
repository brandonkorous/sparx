// Unit coverage for the Tier B generic HTTP-API adapter (docs/100 P5c). No DB:
// `fetch` is stubbed, so this exercises pure response→FeedRow mapping, auth header
// construction, cost-unit conversion, timestamp parsing, and pagination.

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Logger } from 'pino';

import { fetchApiRows } from './http-api.js';

const log = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;

interface Call {
  url: string;
  headers: Record<string, string>;
}

/** Stub global fetch to return `pages` in order (last page repeats if exhausted). */
function mockFetch(pages: unknown[]): Call[] {
  const calls: Call[] = [];
  let i = 0;
  // The adapter only ever calls fetch with string URLs (endpoint / page / cursor).
  globalThis.fetch = vi.fn((url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url, headers: init?.headers ?? {} });
    const body = pages[Math.min(i, pages.length - 1)];
    i++;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    } as Response);
  }) as unknown as typeof fetch;
  return calls;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchApiRows (Tier B HTTP-API adapter)', () => {
  it('maps fields via dot-paths and coerces a string quantity', async () => {
    mockFetch([
      {
        data: {
          items: [
            { sku: 'A', available: 10, location: 'W1' },
            { sku: 'B', available: '5' },
          ],
        },
      },
    ]);

    const rows = await fetchApiRows(
      's1',
      {
        endpoint: 'https://erp.example.com/inv',
        itemsPath: 'data.items',
        skuField: 'sku',
        quantityField: 'available',
        locationField: 'location',
      },
      log
    );

    expect(rows).toEqual([
      {
        externalSku: 'A',
        externalLocation: 'W1',
        quantity: 10,
        unitCostCents: null,
        sourceSyncedAt: null,
      },
      {
        externalSku: 'B',
        externalLocation: null,
        quantity: 5,
        unitCostCents: null,
        sourceSyncedAt: null,
      },
    ]);
  });

  it('sends bearer auth, converts dollar cost to cents, and parses the timestamp', async () => {
    const calls = mockFetch([
      { rows: [{ sku: 'C', qty: 3, cost: 12.5, ts: '2026-06-10T00:00:00Z' }] },
    ]);

    const rows = await fetchApiRows(
      's2',
      {
        endpoint: 'https://erp.example.com/inv',
        authScheme: 'bearer',
        apiKey: 'secret',
        itemsPath: 'rows',
        skuField: 'sku',
        quantityField: 'qty',
        costField: 'cost',
        costUnit: 'dollars',
        syncedAtField: 'ts',
      },
      log
    );

    expect(calls[0]?.headers.Authorization).toBe('Bearer secret');
    expect(rows[0]?.unitCostCents).toBe(1250);
    expect(rows[0]?.sourceSyncedAt).toBe('2026-06-10T00:00:00.000Z');
  });

  it('sends a custom auth header when configured', async () => {
    const calls = mockFetch([[{ sku: 'H', qty: 1 }]]);

    await fetchApiRows(
      's3',
      {
        endpoint: 'https://erp.example.com/inv',
        authScheme: 'header',
        headerName: 'X-API-Key',
        apiKey: 'k123',
        skuField: 'sku',
        quantityField: 'qty',
      },
      log
    );

    expect(calls[0]?.headers['X-API-Key']).toBe('k123');
  });

  it('treats the response body itself as the rows array when itemsPath is blank', async () => {
    mockFetch([[{ sku: 'R1', qty: 9 }]]);

    const rows = await fetchApiRows(
      's4',
      { endpoint: 'https://erp.example.com/inv', skuField: 'sku', quantityField: 'qty' },
      log
    );

    expect(rows).toEqual([
      {
        externalSku: 'R1',
        externalLocation: null,
        quantity: 9,
        unitCostCents: null,
        sourceSyncedAt: null,
      },
    ]);
  });

  it('skips rows with no SKU or a non-numeric quantity', async () => {
    mockFetch([
      {
        items: [
          { sku: 'Z', qty: 'nope' },
          { sku: '', qty: 5 },
          { sku: 'Y', qty: 2 },
        ],
      },
    ]);

    const rows = await fetchApiRows(
      's5',
      {
        endpoint: 'https://erp.example.com/inv',
        itemsPath: 'items',
        skuField: 'sku',
        quantityField: 'qty',
      },
      log
    );

    expect(rows.map((r) => r.externalSku)).toEqual(['Y']);
  });

  it('paginates by page number until an empty page', async () => {
    const calls = mockFetch([
      { items: [{ sku: 'P1', qty: 1 }] },
      { items: [{ sku: 'P2', qty: 2 }] },
      { items: [] },
    ]);

    const rows = await fetchApiRows(
      's6',
      {
        endpoint: 'https://erp.example.com/inv',
        itemsPath: 'items',
        skuField: 'sku',
        quantityField: 'qty',
        pageParam: 'page',
        maxPages: 5,
      },
      log
    );

    expect(rows.map((r) => r.externalSku)).toEqual(['P1', 'P2']);
    expect(calls[0]?.url).toContain('page=1');
    expect(calls[1]?.url).toContain('page=2');
    expect(calls.length).toBe(3);
  });

  it('follows a cursor until it runs out', async () => {
    const calls = mockFetch([
      { data: [{ sku: 'C1', qty: 1 }], meta: { next: 'https://erp.example.com/inv?cursor=abc' } },
      { data: [{ sku: 'C2', qty: 2 }], meta: { next: null } },
    ]);

    const rows = await fetchApiRows(
      's7',
      {
        endpoint: 'https://erp.example.com/inv',
        itemsPath: 'data',
        skuField: 'sku',
        quantityField: 'qty',
        cursorPath: 'meta.next',
        maxPages: 5,
      },
      log
    );

    expect(rows.map((r) => r.externalSku)).toEqual(['C1', 'C2']);
    expect(calls[1]?.url).toBe('https://erp.example.com/inv?cursor=abc');
  });

  it('caps at maxPages even when more pages exist', async () => {
    const calls = mockFetch([
      { items: [{ sku: 'M1', qty: 1 }] },
      { items: [{ sku: 'M2', qty: 1 }] },
      { items: [{ sku: 'M3', qty: 1 }] },
    ]);

    const rows = await fetchApiRows(
      's8',
      {
        endpoint: 'https://erp.example.com/inv',
        itemsPath: 'items',
        skuField: 'sku',
        quantityField: 'qty',
        pageParam: 'page',
        maxPages: 2,
      },
      log
    );

    expect(rows.map((r) => r.externalSku)).toEqual(['M1', 'M2']);
    expect(calls.length).toBe(2);
  });
});

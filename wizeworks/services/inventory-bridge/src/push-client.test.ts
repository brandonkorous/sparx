// Unit coverage for the sparx push client — request shaping, auth, snapshot mapping,
// and the retry policy. `fetch` is stubbed; no network.

import { describe, it, expect, vi, afterEach } from 'vitest';

import { SparxBridgeClient } from './push-client.js';
import type { BridgeConfig } from './config.js';

function cfg(overrides: Partial<BridgeConfig> = {}): BridgeConfig {
  return {
    SPARX_BASE_URL: 'https://api.sparx.test',
    SPARX_SOURCE_ID: '00000000-0000-0000-0000-000000000001',
    SPARX_API_KEY: 'sk_live_test_key',
    BRIDGE_READER: 'file',
    BRIDGE_FILE_PATH: '/tmp/x.csv',
    BRIDGE_FILE_FORMAT: 'csv',
    SYNC_INTERVAL_SEC: 300,
    HEARTBEAT_INTERVAL_SEC: 60,
    REQUEST_TIMEOUT_MS: 30_000,
    MAX_RETRIES: 3,
    ...overrides,
  };
}

interface Captured {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function okFetch(captured: Captured[], data: unknown): void {
  globalThis.fetch = vi.fn(
    (url: string, init: { headers: Record<string, string>; body: string }) => {
      captured.push({
        url,
        headers: init.headers,
        body: JSON.parse(init.body) as Record<string, unknown>,
      });
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(data),
      } as Response);
    }
  ) as unknown as typeof fetch;
}

describe('SparxBridgeClient', () => {
  it('pushes a snapshot with auth, snapshot mode, and per-row synced_at', async () => {
    const captured: Captured[] = [];
    okFetch(captured, { data: { processed: 2, unmatched: 1, skipped: 0, runId: 'r1' } });

    const client = new SparxBridgeClient(cfg());
    const result = await client.pushSnapshot(
      [
        { sku: 'A', location: 'W1', quantity: 10 },
        { sku: 'B', location: null, quantity: 5 },
      ],
      '2026-06-17T00:00:00.000Z'
    );

    expect(result).toEqual({ processed: 2, unmatched: 1, skipped: 0, runId: 'r1' });
    const call = captured[0]!;
    expect(call.url).toBe(
      'https://api.sparx.test/v1/inventory/sources/00000000-0000-0000-0000-000000000001/push'
    );
    expect(call.headers.Authorization).toBe('Bearer sk_live_test_key');
    expect(call.body.mode).toBe('snapshot');
    expect(call.body.rows).toEqual([
      { sku: 'A', location: 'W1', quantity: 10, synced_at: '2026-06-17T00:00:00.000Z' },
      { sku: 'B', quantity: 5, synced_at: '2026-06-17T00:00:00.000Z' },
    ]);
  });

  it('sends the agent version on heartbeat', async () => {
    const captured: Captured[] = [];
    okFetch(captured, { data: { ok: true } });

    await new SparxBridgeClient(cfg()).heartbeat();

    expect(captured[0]!.url).toContain('/heartbeat');
    expect(captured[0]!.body.agentVersion).toBeTruthy();
  });

  it('retries a 5xx then succeeds', async () => {
    vi.useFakeTimers();
    let calls = 0;
    globalThis.fetch = vi.fn(() => {
      calls++;
      if (calls === 1) {
        return Promise.resolve({
          ok: false,
          status: 503,
          text: () => Promise.resolve(''),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { processed: 1, unmatched: 0, skipped: 0 } }),
      } as Response);
    });

    const client = new SparxBridgeClient(cfg());
    const promise = client.pushSnapshot([{ sku: 'A', location: null, quantity: 1 }], 'now');
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(calls).toBe(2);
    expect(result.processed).toBe(1);
  });

  it('does not retry a 4xx (fatal config error)', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(() => {
      calls++;
      return Promise.resolve({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Invalid or expired API key.'),
      } as Response);
    });

    const client = new SparxBridgeClient(cfg());
    await expect(
      client.pushSnapshot([{ sku: 'A', location: null, quantity: 1 }], 'now')
    ).rejects.toThrow(/401/);
    expect(calls).toBe(1);
  });
});

// The sparx client — the agent's only outbound surface. POSTs snapshots + heartbeats
// to the public REST API over HTTPS, authenticated with the bridge's tenant-scoped
// API key (minted by the dashboard's "Pair agent" flow). Transient failures
// (network / 5xx / 429) retry with exponential backoff; a 4xx is fatal (bad config
// — surface it, don't hammer).

import type { BridgeConfig } from './config.js';
import { log } from './logger.js';
import { BRIDGE_VERSION } from './version.js';
import type { BridgeRow } from './readers/types.js';

export interface PushResult {
  processed: number;
  unmatched: number;
  skipped: number;
  runId?: string;
}

export class SparxBridgeClient {
  private readonly base: string;
  private readonly sourceId: string;
  private readonly headers: Record<string, string>;

  constructor(private readonly config: BridgeConfig) {
    this.base = config.SPARX_BASE_URL.replace(/\/$/, '');
    this.sourceId = config.SPARX_SOURCE_ID;
    this.headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.SPARX_API_KEY}`,
    };
  }

  /** Push a full on-hand snapshot — sparx reconciles each row through its ledger,
   *  stamps `synced_at` for last-writer ordering, and flags dropped mappings stale. */
  async pushSnapshot(rows: BridgeRow[], observedAt: string): Promise<PushResult> {
    const body = {
      mode: 'snapshot',
      rows: rows.map((r) => ({
        sku: r.sku,
        ...(r.location ? { location: r.location } : {}),
        quantity: r.quantity,
        synced_at: observedAt,
      })),
    };
    const res = await this.request(`/v1/inventory/sources/${this.sourceId}/push`, body);
    return (res?.data ?? res) as PushResult;
  }

  /** Liveness ping — keeps the online indicator fresh between snapshots. */
  async heartbeat(): Promise<void> {
    await this.request(`/v1/inventory/sources/${this.sourceId}/heartbeat`, {
      agentVersion: BRIDGE_VERSION,
    });
  }

  private async request(path: string, body: unknown): Promise<{ data?: unknown } | null> {
    const url = `${this.base}${path}`;
    let attempt = 0;
    for (;;) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.config.REQUEST_TIMEOUT_MS),
        });
        if (res.ok) return (await res.json().catch(() => null)) as { data?: unknown } | null;

        // 4xx (except 429) is a client/config error — retrying won't help.
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          const text = await res.text().catch(() => '');
          throw new FatalRequestError(`${res.status} ${url}: ${text.slice(0, 300)}`);
        }
        throw new Error(`${res.status} ${url}`);
      } catch (err) {
        if (err instanceof FatalRequestError) throw err;
        attempt++;
        if (attempt > this.config.MAX_RETRIES) throw err;
        const delayMs = backoffMs(attempt);
        log.warn('request failed — retrying', { url, attempt, delayMs, err: errMessage(err) });
        await sleep(delayMs);
      }
    }
  }
}

class FatalRequestError extends Error {}

/** Exponential backoff with a ceiling: 1s, 2s, 4s, … capped at 30s. */
function backoffMs(attempt: number): number {
  return Math.min(30_000, 1_000 * 2 ** (attempt - 1));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

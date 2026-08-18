// Tier B adapter — a generic SaaS HTTP-API pull (docs/100 P5c, docs/28).
//
// ONE config-driven adapter serves any JSON inventory API (NetSuite, Cin7, a 3PL
// portal, …) without per-vendor code: the source's `config` (validated by
// `ApiSourceConfig`) declares where to fetch, how to authenticate, the dot-path to
// the rows array, and the dot-path to each field on a row. It returns normalized
// `FeedRow`s that flow into the SAME `inventoryService.ingestFeed` funnel the CSV
// worker and the push endpoint use — so matching, reconciliation, the unmapped
// queue, last-writer ordering, and run bookkeeping are all shared.

import type { Logger } from 'pino';
import { ApiSourceConfig } from '@wizeworks/commerce-schemas';
import type { FeedRow } from '@wizeworks/inventory';

const MAX_ROWS = 50_000;
const FETCH_TIMEOUT_MS = 30_000;

type ApiConfig = ApiSourceConfig;

/** Fetch + map an API source's feed into normalized ingest rows (paginated). */
export async function fetchApiRows(
  sourceId: string,
  rawConfig: Record<string, unknown>,
  log: Logger
): Promise<FeedRow[]> {
  const cfg = ApiSourceConfig.parse(rawConfig);
  const headers = buildHeaders(cfg);
  const rows: FeedRow[] = [];

  let url: string | null = pageUrl(cfg, 1);
  let pagesFetched = 0;

  while (url && pagesFetched < cfg.maxPages && rows.length < MAX_ROWS) {
    log.info({ sourceId, url, page: pagesFetched + 1 }, 'inventory-worker: fetching API page');
    const body = await fetchJson(url, headers);
    const items = extractItems(body, cfg);
    pagesFetched++;

    for (const item of items) {
      if (rows.length >= MAX_ROWS) break;
      const row = mapRow(item, cfg, log);
      if (row) rows.push(row);
    }

    url = nextUrl(cfg, body, items.length, pagesFetched);
  }

  log.info({ sourceId, rowCount: rows.length, pages: pagesFetched }, 'inventory-worker: API rows');
  return rows;
}

function buildHeaders(cfg: ApiConfig): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (cfg.authScheme === 'bearer' && cfg.apiKey) {
    headers.Authorization = `Bearer ${cfg.apiKey}`;
  } else if (cfg.authScheme === 'header' && cfg.apiKey && cfg.headerName) {
    headers[cfg.headerName] = cfg.apiKey;
  }
  return headers;
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`API fetch failed: ${res.status} ${url}`);
  return res.json();
}

/** Resolve the rows array via `itemsPath` ('' = the body itself is the array). */
function extractItems(body: unknown, cfg: ApiConfig): unknown[] {
  const value = cfg.itemsPath ? getPath(body, cfg.itemsPath) : body;
  if (!Array.isArray(value)) {
    throw new Error(`API response items path '${cfg.itemsPath || '(root)'}' is not an array`);
  }
  return value;
}

/** The next page URL: a cursor value, an incremented page param, or null (done). */
function nextUrl(
  cfg: ApiConfig,
  body: unknown,
  itemCount: number,
  pagesFetched: number
): string | null {
  if (pagesFetched >= cfg.maxPages) return null;
  if (cfg.cursorPath) {
    const cursor = getPath(body, cfg.cursorPath);
    return typeof cursor === 'string' && cursor.length > 0 ? cursor : null;
  }
  if (cfg.pageParam) {
    return itemCount > 0 ? pageUrl(cfg, pagesFetched + 1) : null;
  }
  return null;
}

function pageUrl(cfg: ApiConfig, page: number): string {
  if (!cfg.pageParam) return cfg.endpoint;
  const u = new URL(cfg.endpoint);
  u.searchParams.set(cfg.pageParam, String(page));
  return u.toString();
}

/** Map one API item onto a FeedRow via the configured field dot-paths. Returns
 *  null (with a warning) when the row lacks a usable SKU or quantity. */
function mapRow(item: unknown, cfg: ApiConfig, log: Logger): FeedRow | null {
  if (item === null || typeof item !== 'object') return null;
  const sku = toStr(getPath(item, cfg.skuField));
  if (!sku) return null;

  const quantity = toNum(getPath(item, cfg.quantityField));
  if (quantity === null) {
    log.warn({ sku }, 'inventory-worker: API row has no numeric quantity — skipping');
    return null;
  }

  return {
    externalSku: sku,
    externalLocation: cfg.locationField ? toStr(getPath(item, cfg.locationField)) : null,
    quantity: Math.max(0, Math.trunc(quantity)),
    unitCostCents: cfg.costField ? toCents(getPath(item, cfg.costField), cfg.costUnit) : null,
    sourceSyncedAt: cfg.syncedAtField ? toIso(getPath(item, cfg.syncedAtField)) : null,
  };
}

// ─── value helpers ──────────────────────────────────────────────────────────────

/** Walk a dot-path (`data.items.0.qty`) into a nested object/array. */
function getPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function toStr(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function toNum(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = Number.parseFloat(value);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function toCents(value: unknown, unit: 'cents' | 'dollars'): number | null {
  const n = toNum(value);
  if (n === null) return null;
  return unit === 'dollars' ? Math.round(n * 100) : Math.round(n);
}

function toIso(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

// Search Console ingestion (docs/50 §7, docs/97 §4). One sync per connected
// (tenant, property): refresh the access token if stale, pull the Search
// Analytics API for the trailing window, and overwrite the daily rollup + the
// top-queries snapshot. Idempotent (delete-window-then-insert for the rollup;
// replace-all for queries), so a re-run or a backfill is safe.
//
// Runs from two places: the nightly k8s CronJob (every connected tenant) and a
// user-triggered "Sync now" button. Both call syncConnection inside withTenant,
// so RLS scopes every read/write to the owning tenant.

import type { TxClient } from '@sparx/db';
import { badRequest } from '@sparx/api-core/errors';

import { decryptToken, encryptToken } from './crypto.js';
import { querySearchAnalytics, refreshAccessToken, type GscRow } from './google.js';
import { addUtcDays, startOfUtcDay, utcDateKey } from './reports.js';

// 16 months is GSC's retention ceiling; 90 days gives the overview a full
// quarter of history (incl. the month grain) without a heavy first pull.
const ROLLUP_WINDOW_DAYS = 90;
// Top queries are a "right now" snapshot — a 28-day trailing window matches what
// merchants expect from "what are people searching to find me".
const QUERY_WINDOW_DAYS = 28;
const TOP_QUERIES = 25;

/** The connection fields a sync needs — a subset of the Prisma row so callers
 *  can pass a `select`ed object. */
export interface SyncableConnection {
  id: string;
  tenantId: string;
  propertyId: string;
  siteUrl: string | null;
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  tokenExpiresAt: Date | null;
}

/** Prisma `select` matching {@link SyncableConnection} — shared by the routes and
 *  the ingestion cron so both fetch exactly the fields a sync needs. */
export const SYNC_CONNECTION_SELECT = {
  id: true,
  tenantId: true,
  propertyId: true,
  siteUrl: true,
  accessTokenEnc: true,
  refreshTokenEnc: true,
  tokenExpiresAt: true,
} as const;

export interface SyncResult {
  days: number;
  queries: number;
}

/** Return a usable access token, refreshing + persisting a new one when the
 *  stored token is missing or expired. Exported so the connection routes (e.g.
 *  the site picker) can get a fresh token without re-implementing the refresh. */
export async function ensureAccessToken(tx: TxClient, conn: SyncableConnection): Promise<string> {
  const stillFresh =
    conn.accessTokenEnc &&
    conn.tokenExpiresAt &&
    new Date(conn.tokenExpiresAt).getTime() > Date.now();
  if (stillFresh && conn.accessTokenEnc) return decryptToken(conn.accessTokenEnc);

  if (!conn.refreshTokenEnc) {
    throw badRequest('Search Console needs to be reconnected (no refresh token on file).');
  }
  const tokens = await refreshAccessToken(decryptToken(conn.refreshTokenEnc));
  await tx.searchConsoleConnection.update({
    where: { id: conn.id },
    data: {
      accessTokenEnc: encryptToken(tokens.accessToken),
      tokenExpiresAt: tokens.expiresAt,
      // Google rarely rotates the refresh token, but persist it when it does.
      ...(tokens.refreshToken ? { refreshTokenEnc: encryptToken(tokens.refreshToken) } : {}),
    },
  });
  return tokens.accessToken;
}

const toSumPosition = (row: GscRow): bigint => BigInt(Math.round(row.position * row.impressions));

/** Pull GSC and overwrite this property's rollup + top queries. Stamps
 *  status/lastSyncAt/lastError on success. The caller is responsible for
 *  catching + recording failures (the cron stores them in last_error). */
export async function syncConnection(tx: TxClient, conn: SyncableConnection): Promise<SyncResult> {
  if (!conn.siteUrl) throw badRequest('No Search Console site selected for this connection.');
  const accessToken = await ensureAccessToken(tx, conn);

  const end = startOfUtcDay(new Date());
  const rollupStart = addUtcDays(end, -(ROLLUP_WINDOW_DAYS - 1));
  const queryStart = addUtcDays(end, -(QUERY_WINDOW_DAYS - 1));

  // ── Daily rollup ──
  const dateRows = await querySearchAnalytics(accessToken, conn.siteUrl, {
    startDate: utcDateKey(rollupStart),
    endDate: utcDateKey(end),
    dimensions: ['date'],
    rowLimit: ROLLUP_WINDOW_DAYS + 1,
  });
  // flatMap (not filter+map) so TS narrows the day key to a defined string.
  const rollupData = dateRows.flatMap((r) => {
    const day = r.keys[0];
    if (!day) return [];
    return [
      {
        tenantId: conn.tenantId,
        propertyId: conn.propertyId,
        bucket: startOfUtcDay(new Date(`${day}T00:00:00.000Z`)),
        clicks: Math.round(r.clicks),
        impressions: Math.round(r.impressions),
        sumPosition: toSumPosition(r),
      },
    ];
  });

  await tx.rollupSearchConsoleDaily.deleteMany({
    where: { propertyId: conn.propertyId, bucket: { gte: rollupStart } },
  });
  if (rollupData.length > 0) {
    await tx.rollupSearchConsoleDaily.createMany({ data: rollupData });
  }

  // ── Top queries (replaced wholesale) ──
  const queryRows = await querySearchAnalytics(accessToken, conn.siteUrl, {
    startDate: utcDateKey(queryStart),
    endDate: utcDateKey(end),
    dimensions: ['query'],
    rowLimit: TOP_QUERIES,
  });
  const queryData = queryRows.flatMap((r) => {
    const q = r.keys[0];
    if (!q) return [];
    return [
      {
        tenantId: conn.tenantId,
        propertyId: conn.propertyId,
        query: q.slice(0, 512),
        clicks: Math.round(r.clicks),
        impressions: Math.round(r.impressions),
        sumPosition: toSumPosition(r),
      },
    ];
  });

  await tx.searchConsoleQuery.deleteMany({ where: { propertyId: conn.propertyId } });
  if (queryData.length > 0) {
    await tx.searchConsoleQuery.createMany({ data: queryData });
  }

  await tx.searchConsoleConnection.update({
    where: { id: conn.id },
    data: { status: 'connected', lastSyncAt: new Date(), lastError: null },
  });

  return { days: rollupData.length, queries: queryData.length };
}

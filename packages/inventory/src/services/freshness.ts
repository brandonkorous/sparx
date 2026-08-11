// Feed freshness — how old a stock number is allowed to get (docs/146 Phase 1).
//
// The sync module already reports whether the last run SUCCEEDED. That is the
// wrong question. A feed whose last run succeeded four days ago looks perfectly
// healthy on every dashboard, and the number it left behind is worthless — this
// is the exact shape of the complaint that recurs across every marketplace
// connector's reviews ("synchronization doesn't work", overselling, account
// health hit). Nothing was broken. The number just quietly rotted.
//
// So a source declares a PROMISE — `expectedIntervalSec`, the age past which its
// stock is suspect — and the sweep below holds it to that promise. On a breach
// the source is flagged, `staleSince` records when it started (so "stale for
// three days" is answerable, not just "stale"), an event fires, and the declared
// `stalenessPolicy` decides what actually happens to selling:
//
//   warn          flag + banner. Loud, reversible, and enough on a storefront
//                 that reads levels live.
//   buffer_up     additionally withhold `stalenessBuffer` more units, so the lag
//                 eats the cushion instead of a customer's order.
//   pause_channel additionally stop external channel selling of this source's
//                 stock until a sync lands. Correct where an oversell costs
//                 marketplace account health rather than one apology.
//
// The penalty is TEMPORARY and ADDITIVE — it stacks on top of the configured
// channel buffer (./channel-buffers.ts) rather than replacing it, because it
// expresses "we are currently flying blind", not "this is how much we withhold".

import { SetSourceFreshnessInput } from '@sparx/commerce-schemas';
import { Prisma, withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { InventoryNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';
import { publishInventoryEvent } from '../events';

// ─── Row shapes ────────────────────────────────────────────────────────────────

export interface SourceFreshnessRow {
  sourceId: string;
  name: string;
  type: string;
  status: string;
  lastSyncAt: string | null;
  /** Seconds since the last successful sync. Null when the source has never run. */
  ageSeconds: number | null;
  expectedIntervalSec: number;
  stalenessPolicy: string;
  stalenessBuffer: number;
  isStale: boolean;
  staleSince: string | null;
  /** How far past the promise, in seconds. 0 when inside it. */
  overdueSeconds: number;
  /** Number of (variant, warehouse) levels this source feeds — the blast radius. */
  linkedLevels: number;
}

export interface FreshnessSweepResult {
  sourcesChecked: number;
  newlyStale: number;
  recovered: number;
  stillStale: number;
}

/** The staleness penalty in force for one level, and why. Returned even when
 *  there is none, because "this number is fresh" is a result the provenance UI
 *  needs to be able to state positively. */
export interface StalenessPenalty {
  /** Extra units withheld on top of the configured channel buffer. */
  extraBuffer: number;
  /** True when external channel selling should stop for this level. */
  pauseChannels: boolean;
  /** The stale sources feeding this level, if any. */
  staleSources: { sourceId: string; name: string; policy: string; staleSince: string | null }[];
}

const NO_PENALTY: StalenessPenalty = { extraBuffer: 0, pauseChannels: false, staleSources: [] };

// ─── Configuration ─────────────────────────────────────────────────────────────

export async function setSourceFreshness(
  ctx: ServiceContext,
  sourceId: string,
  rawInput: unknown
): Promise<SourceFreshnessRow> {
  const input = SetSourceFreshnessInput.parse(rawInput);

  await withTenant(ctx, async (tx) => {
    const existing = await tx.inventorySource.findFirst({
      where: { id: sourceId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true, expectedIntervalSec: true, stalenessPolicy: true, isStale: true },
    });
    if (!existing) throw new InventoryNotFoundError('InventorySource', sourceId);

    await tx.inventorySource.update({
      where: { id: sourceId },
      data: {
        expectedIntervalSec: input.expectedIntervalSec,
        ...(input.stalenessPolicy !== undefined ? { stalenessPolicy: input.stalenessPolicy } : {}),
        ...(input.stalenessBuffer !== undefined ? { stalenessBuffer: input.stalenessBuffer } : {}),
        // Dropping the SLO clears the flag: a source that is exempt cannot be in
        // breach, and leaving a stale banner on an exempt source is a bug report
        // waiting to happen.
        ...(input.expectedIntervalSec === 0 ? { isStale: false, staleSince: null } : {}),
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.source.freshness_updated',
      entityType: 'InventorySource',
      entityId: sourceId,
      diff: {
        before: {
          expectedIntervalSec: existing.expectedIntervalSec,
          stalenessPolicy: existing.stalenessPolicy,
        },
        after: {
          expectedIntervalSec: input.expectedIntervalSec,
          stalenessPolicy: input.stalenessPolicy ?? existing.stalenessPolicy,
        },
      },
    });
  });

  const rows = await listSourceFreshness(ctx, { sourceId });
  const row = rows[0];
  if (!row) throw new InventoryNotFoundError('InventorySource', sourceId);
  return row;
}

// ─── Reads ─────────────────────────────────────────────────────────────────────

interface FreshnessQueryRow {
  sourceId: string;
  name: string;
  type: string;
  status: string;
  lastSyncAt: Date | null;
  expectedIntervalSec: number;
  stalenessPolicy: string;
  stalenessBuffer: number;
  isStale: boolean;
  staleSince: Date | null;
  linkedLevels: number;
}

export async function listSourceFreshness(
  ctx: ServiceContext,
  filter: { sourceId?: string; staleOnly?: boolean } = {}
): Promise<SourceFreshnessRow[]> {
  return withTenant(ctx, async (tx) => {
    // Composed fragments rather than three near-identical query literals — which
    // is how the filtered and unfiltered forms drift apart.
    const sourceFilter = filter.sourceId
      ? Prisma.sql`AND s.id = ${filter.sourceId}::uuid`
      : Prisma.empty;
    const staleFilter = filter.staleOnly ? Prisma.sql`AND s.is_stale = true` : Prisma.empty;

    const rows = await tx.$queryRaw<FreshnessQueryRow[]>`
      SELECT s.id                    AS "sourceId",
             s.name                  AS "name",
             s.type                  AS "type",
             s.status                AS "status",
             s.last_sync_at          AS "lastSyncAt",
             s.expected_interval_sec AS "expectedIntervalSec",
             s.staleness_policy      AS "stalenessPolicy",
             s.staleness_buffer      AS "stalenessBuffer",
             s.is_stale              AS "isStale",
             s.stale_since           AS "staleSince",
             COALESCE((
               SELECT COUNT(*)::int FROM inventory_source_links sl
                WHERE sl.source_id = s.id AND sl.status = 'active'
             ), 0)                   AS "linkedLevels"
        FROM inventory_sources s
       WHERE s.tenant_id = ${ctx.tenantId}::uuid
         AND s.deleted_at IS NULL
         ${sourceFilter}
         ${staleFilter}
       ORDER BY s.is_stale DESC, s.name ASC
    `;
    const now = Date.now();
    return rows.map((r) => {
      const ageSeconds = r.lastSyncAt ? Math.floor((now - r.lastSyncAt.getTime()) / 1000) : null;
      const overdueSeconds =
        r.expectedIntervalSec > 0 && ageSeconds !== null
          ? Math.max(0, ageSeconds - r.expectedIntervalSec)
          : 0;
      return {
        sourceId: r.sourceId,
        name: r.name,
        type: r.type,
        status: r.status,
        lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
        ageSeconds,
        expectedIntervalSec: r.expectedIntervalSec,
        stalenessPolicy: r.stalenessPolicy,
        stalenessBuffer: r.stalenessBuffer,
        isStale: r.isStale,
        staleSince: r.staleSince?.toISOString() ?? null,
        overdueSeconds,
        linkedLevels: r.linkedLevels,
      };
    });
  });
}

// ─── The sweep ─────────────────────────────────────────────────────────────────

/**
 * Evaluate every SLO-declaring source for one tenant and flip the flags.
 *
 * Idempotent: re-running inside the same breach changes nothing and emits
 * nothing. Events fire on the TRANSITIONS only — a source that has been stale
 * for a week should have produced one alarm, not one per sweep.
 */
export async function sweepSourceFreshness(ctx: ServiceContext): Promise<FreshnessSweepResult> {
  const transitions = await withTenant(ctx, async (tx) => {
    const sources = await tx.inventorySource.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null, expectedIntervalSec: { gt: 0 } },
      select: {
        id: true,
        name: true,
        lastSyncAt: true,
        expectedIntervalSec: true,
        stalenessPolicy: true,
        isStale: true,
      },
    });

    const now = Date.now();
    const becameStale: { id: string; name: string; policy: string; ageSeconds: number }[] = [];
    const recovered: { id: string; name: string }[] = [];
    let stillStale = 0;

    for (const s of sources) {
      // A source that has NEVER synced is measured from nothing, so it cannot be
      // "overdue" in any meaningful sense — it is unconfigured, which the sources
      // list already says plainly. Flagging it stale as well is noise that trains
      // people to ignore the flag.
      if (!s.lastSyncAt) continue;

      const ageSeconds = Math.floor((now - s.lastSyncAt.getTime()) / 1000);
      const breached = ageSeconds > s.expectedIntervalSec;

      if (breached && !s.isStale) {
        await tx.inventorySource.update({
          where: { id: s.id },
          data: { isStale: true, staleSince: new Date() },
        });
        becameStale.push({
          id: s.id,
          name: s.name,
          policy: s.stalenessPolicy,
          ageSeconds,
        });
      } else if (!breached && s.isStale) {
        await tx.inventorySource.update({
          where: { id: s.id },
          data: { isStale: false, staleSince: null },
        });
        recovered.push({ id: s.id, name: s.name });
      } else if (breached) {
        stillStale += 1;
      }
    }

    return { sourcesChecked: sources.length, becameStale, recovered, stillStale };
  });

  for (const s of transitions.becameStale) {
    await publishInventoryEvent({
      tenantId: ctx.tenantId,
      actorId: null,
      topic: 'inventory.source.stale',
      data: {
        sourceId: s.id,
        sourceName: s.name,
        policy: s.policy,
        ageSeconds: s.ageSeconds,
      },
    });
  }
  for (const s of transitions.recovered) {
    await publishInventoryEvent({
      tenantId: ctx.tenantId,
      actorId: null,
      topic: 'inventory.source.recovered',
      data: { sourceId: s.id, sourceName: s.name },
    });
  }

  return {
    sourcesChecked: transitions.sourcesChecked,
    newlyStale: transitions.becameStale.length,
    recovered: transitions.recovered.length,
    stillStale: transitions.stillStale,
  };
}

// ─── The penalty ───────────────────────────────────────────────────────────────

export interface StaleSourceRow {
  sourceId: string;
  name: string;
  policy: string;
  stalenessBuffer: number;
  staleSince: Date | null;
}

/**
 * The staleness penalty in force for one (variant, warehouse), inside the
 * caller's transaction.
 *
 * A level can legitimately be fed by more than one source (a warehouse mirrored
 * from an ERP whose overflow bin is also pushed by a 3PL). When several are in
 * breach we take the WORST of each dimension — the largest extra buffer, and
 * pause-channels if any of them says so. Averaging would produce a cushion that
 * protects against neither.
 */
export async function resolveStalenessPenaltyOnTx(
  tx: TxClient,
  ctx: ServiceContext,
  input: { variantId: string; warehouseId: string }
): Promise<StalenessPenalty> {
  const rows = await tx.$queryRaw<StaleSourceRow[]>`
    SELECT s.id               AS "sourceId",
           s.name             AS "name",
           s.staleness_policy AS "policy",
           s.staleness_buffer AS "stalenessBuffer",
           s.stale_since      AS "staleSince"
      FROM inventory_source_links sl
      JOIN inventory_sources s ON s.id = sl.source_id
     WHERE sl.tenant_id = ${ctx.tenantId}::uuid
       AND sl.variant_id = ${input.variantId}::uuid
       AND sl.warehouse_id = ${input.warehouseId}::uuid
       AND sl.status = 'active'
       AND s.deleted_at IS NULL
       AND s.is_stale = true
  `;
  return combineStalenessPenalty(rows);
}

/**
 * Combine several stale sources into one penalty, with no database in it.
 *
 * Split out so the combination rule can be tested directly. WORST-OF each
 * dimension independently: the largest extra buffer any `buffer_up` source asks
 * for, and pause-channels if ANY source says so. Averaging the buffers — the
 * obvious-looking alternative — would produce a cushion that protects against
 * neither source, and taking only the first would make the outcome depend on
 * row order.
 */
export function combineStalenessPenalty(rows: StaleSourceRow[]): StalenessPenalty {
  if (rows.length === 0) return NO_PENALTY;

  return {
    extraBuffer: rows.reduce(
      (max, r) => (r.policy === 'buffer_up' ? Math.max(max, r.stalenessBuffer) : max),
      0
    ),
    pauseChannels: rows.some((r) => r.policy === 'pause_channel'),
    staleSources: rows.map((r) => ({
      sourceId: r.sourceId,
      name: r.name,
      policy: r.policy,
      staleSince: r.staleSince?.toISOString() ?? null,
    })),
  };
}

/** Public form — opens its own tenant transaction. For read paths (provenance,
 *  channel push) rather than the locked sell path. */
export async function resolveStalenessPenalty(
  ctx: ServiceContext,
  input: { variantId: string; warehouseId: string }
): Promise<StalenessPenalty> {
  return withTenant(ctx, (tx) => resolveStalenessPenaltyOnTx(tx, ctx, input));
}

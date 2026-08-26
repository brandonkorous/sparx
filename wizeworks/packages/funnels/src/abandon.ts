// The abandonment sweep — the only funnel signal with nobody behind it.
//
// `funnel.entered` and `funnel.converted` are announcements of something that
// just happened, published by whoever handled the request. `funnel.abandoned` is
// the opposite: NOBODY DID ANYTHING, and that absence is the signal. It needs a
// clock rather than a caller, and it is the event that drives the follow-up that
// actually recovers a sale, so a funnel without it is a report you have to
// remember to open.
//
// ── WHY THIS IS STATELESS, AND WHAT THAT COSTS ──────────────────────────────
//
// A subject is abandoned when their LAST activity on a funnel is older than that
// funnel's patience and they never reached the converting rung. The obvious
// implementation ("find everyone stalled, emit") re-emits the same person every
// single night forever, so something has to remember who was already announced.
//
// There is deliberately no such table. Instead the sweep looks at a BOUNDED
// WINDOW: subjects whose stall CROSSED the threshold since the last run. A
// nightly sweep with a 25-hour window sees each subject on exactly one night and
// never again, with no state to keep, migrate, or get wrong.
//
// The cost is real and worth stating plainly: **a missed run skips those
// subjects permanently.** They are not re-announced later. That is the right
// trade for a notification trigger (a late "they went quiet" is worth little,
// and a duplicate is worse than a miss), and it is wrong for anything that must
// not be lost — so nothing here should ever grow into a billing or fulfilment
// path. Widen `windowHours` on the call to cover a known outage.
//
// The read is bounded by `(tenant_id, funnel_id, occurred_at DESC)`, added in
// the same migration as the patience column.

import { withTenant, type TenantContext, type TxClient } from '@wizeworks/db';
import type { Funnel } from '@prisma/client';

import { stagesOf } from './index.js';
import { stallHoursOf, type StageKind } from './schemas.js';

/** One subject who stopped moving. Exactly one of the two identity fields is
 *  set, the same exclusive-or every stage row carries. */
export interface AbandonedSubject {
  funnelId: string;
  funnelName: string;
  propertyId: string;
  /** The rung they stopped on — the useful half, because "went quiet after
   *  giving us their email" and "went quiet after telling us their budget" are
   *  different problems with different follow-ups. */
  stageKey: string;
  /** What that rung DOES, so a consumer can branch without re-reading the
   *  ladder. Never `view`: nobody anonymous is ever recorded. */
  stageKind: StageKind;
  customerId: string | null;
  subjectEmail: string | null;
  entrySource: string | null;
  entryCampaign: string | null;
  /** When they were last seen doing anything in this funnel. */
  lastSeenAt: Date;
}

export interface SweepResult {
  /** Active funnels examined. */
  funnels: number;
  subjects: AbandonedSubject[];
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Everyone who went quiet in the window that just closed.
 *
 * Reads only; it publishes nothing and writes nothing. The caller announces,
 * which keeps this package free of a broker dependency and keeps the sweep
 * testable without one.
 *
 * `windowHours` should be the sweep's own interval plus a little slack — 25 for
 * a nightly job. Too narrow and a late run misses people; too wide and the same
 * person is announced on two consecutive nights.
 */
export async function findAbandoned(
  ctx: TenantContext,
  now: Date,
  windowHours = 25
): Promise<SweepResult> {
  return withTenant(ctx, async (tx) => {
    // Only ACTIVE funnels. A paused funnel keeps its history and stops gaining
    // it, and it must stop generating follow-ups too — otherwise pausing a
    // campaign still emails people, which is the opposite of what pause means.
    const funnels = await tx.funnel.findMany({ where: { status: 'active' } });

    const subjects: AbandonedSubject[] = [];
    for (const funnel of funnels) {
      subjects.push(...(await abandonedIn(tx, funnel, now, windowHours)));
    }
    return { funnels: funnels.length, subjects };
  });
}

async function abandonedIn(
  tx: TxClient,
  funnel: Funnel,
  now: Date,
  windowHours: number
): Promise<AbandonedSubject[]> {
  // A ladder that does not parse is skipped rather than guessed at: emitting
  // "abandoned" against a funnel whose rungs we cannot read would name a stage
  // key nothing downstream can interpret.
  let kindByKey: Map<string, StageKind>;
  try {
    kindByKey = new Map(stagesOf(funnel).map((s) => [s.key, s.kind]));
  } catch {
    return [];
  }

  const patienceMs = stallHoursOf(funnel) * HOUR_MS;
  // The window that just closed: last seen between (patience + window) and
  // patience ago. Anyone earlier was announced on a previous run; anyone later
  // has not run out of patience yet.
  const quietSince = new Date(now.getTime() - patienceMs);
  const windowStart = new Date(quietSince.getTime() - windowHours * HOUR_MS);

  // Every event for this funnel from the window's start onward. Reading from
  // `windowStart` rather than only the window itself is what makes "and nothing
  // since" answerable: a subject with any activity after `quietSince` has not
  // gone quiet, and without those rows we could not tell.
  const rows = await tx.funnelStageEvent.findMany({
    where: { funnelId: funnel.id, occurredAt: { gte: windowStart } },
    orderBy: { occurredAt: 'asc' },
    select: {
      stageKey: true,
      customerId: true,
      subjectEmail: true,
      entrySource: true,
      entryCampaign: true,
      occurredAt: true,
    },
  });

  // Fold to one record per subject: their latest activity, and whether they ever
  // converted. A person is one person however many rungs they touched.
  const latest = new Map<string, (typeof rows)[number]>();
  const converted = new Set<string>();
  for (const row of rows) {
    const key = row.customerId ? `c:${row.customerId}` : `e:${row.subjectEmail ?? ''}`;
    latest.set(key, row); // ordered ascending, so the last write is the latest
    if (kindByKey.get(row.stageKey) === 'convert') converted.add(key);
  }

  const out: AbandonedSubject[] = [];
  for (const [key, row] of latest) {
    // Already converted means nothing left to abandon; still moving means not
    // abandoned yet. Both are ordinary and neither is an event.
    if (converted.has(key)) continue;
    if (row.occurredAt > quietSince) continue;
    // A rung the ladder no longer has cannot be described to a consumer, and a
    // follow-up keyed on it would name a stage nothing can interpret.
    const stageKind = kindByKey.get(row.stageKey);
    if (!stageKind) continue;
    out.push({
      funnelId: funnel.id,
      funnelName: funnel.name,
      propertyId: funnel.propertyId,
      stageKey: row.stageKey,
      stageKind,
      customerId: row.customerId,
      subjectEmail: row.subjectEmail,
      entrySource: row.entrySource,
      entryCampaign: row.entryCampaign,
      lastSeenAt: row.occurredAt,
    });
  }
  return out;
}

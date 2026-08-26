// Announcing a stage — the one part of this package that knows about the bus.
//
// It is a SEPARATE ENTRY POINT (`@wizeworks/funnels/announce`) rather than part
// of the main barrel, and the split is load-bearing. `./index` is deliberately
// backend-safe with nothing but the database and the schema packages behind it,
// which is what lets the event-worker run the nightly reconcile without dragging
// api-core's closure in. Importing the broker there would quietly undo that for
// every consumer, including the ones that only ever read a ladder.
//
// Two transports use this — the REST routes and the MCP tools — so it lives here
// rather than in either of them. A conversion recorded by an agent and a
// conversion recorded through the API must reach an automation identically;
// anything else means "did it come in through MCP?" becomes a thing somebody has
// to know.

import { publish } from '@wizeworks/api-core/pubsub';
import type { EventType, FunnelStageEventPayload } from '@wizeworks/events';
import type { Funnel, FunnelStageEvent } from '@prisma/client';

import { getFunnel, stagesOf } from './index.js';
import type { FunnelStage, StageKind } from './schemas.js';

/** What `publish` wants. Structural rather than a fastify import: this package
 *  has no HTTP layer, and the MCP transport hands it `console`. */
type PublishLogger = Parameters<typeof publish>[0];

/**
 * Announce a recorded stage, when the rung is one the platform has an event for.
 *
 * Only two rungs are announcements. `capture` is somebody entering the funnel —
 * and a funnel only ever "enters" there, because everything above that line is
 * anonymous and aggregate, so there is no person an event could be about
 * (docs/151 §4). `convert` is the outcome the campaign exists for. A `qualify` or
 * `engage` rung publishes nothing: there is no event type for it, and inventing
 * one so that every rung emits something would put three events on the bus for
 * one person's afternoon.
 *
 * Best-effort and never throws. The row is already written; a failed announce
 * costs a follow-up, not the record of what happened.
 *
 * Re-reads the funnel to build the payload, which `recordStage` also read. Two
 * indexed reads on a path that already did several, in exchange for the caller
 * not having to hold a funnel it never asked for.
 */
export async function announceStage(
  log: PublishLogger,
  tenantId: string,
  row: FunnelStageEvent
): Promise<void> {
  try {
    const funnel = await getFunnel({ tenantId }, row.funnelId);
    if (!funnel) return;
    const stage = stageOf(funnel, row.stageKey);
    const type = stage && EVENT_FOR_KIND[stage.kind];
    if (!stage || !type) return;

    const payload: FunnelStageEventPayload = {
      funnelId: funnel.id,
      funnelName: funnel.name,
      propertyId: funnel.propertyId,
      // The KEY, never the display name: a renamed stage keeps its history, and
      // a consumer keyed on the label breaks the first time somebody edits it.
      stageKey: row.stageKey,
      stageKind: stage.kind,
      customerId: row.customerId,
      subjectEmail: row.subjectEmail,
      // Null means unpriced, never zero. A conversion nobody has valued and a
      // conversion worth nothing are different facts.
      valueCents: row.valueCents === null ? null : Number(row.valueCents),
      entrySource: row.entrySource,
      entryCampaign: row.entryCampaign,
    };
    // No actor: nobody on the tenant's staff did this, the subject did.
    await publish(log, type, tenantId, null, { ...payload });
  } catch (err) {
    log.warn({ err, funnelId: row.funnelId }, 'funnel stage announce failed');
  }
}

const EVENT_FOR_KIND: Partial<Record<StageKind, EventType>> = {
  capture: 'funnel.entered',
  convert: 'funnel.converted',
};

/** The rung, or undefined when the key is unknown or the stored ladder does not
 *  parse. Both are reasons to stay quiet rather than to guess. */
function stageOf(funnel: Funnel, stageKey: string): FunnelStage | undefined {
  try {
    return stagesOf(funnel).find((s) => s.key === stageKey);
  } catch {
    return undefined;
  }
}

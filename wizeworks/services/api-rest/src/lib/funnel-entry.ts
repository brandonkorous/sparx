// The capture stitch (docs/151 §4, docs/152 B3) — where the funnel's two halves
// of identity meet, exactly once, and then stop touching each other.
//
// ── WHAT THE STITCH IS ──────────────────────────────────────────────────────
//
// Above the capture line a funnel counts anonymous page visits and knows nobody.
// Below it, every row names a person. The join happens at the single moment a
// visitor stops being anonymous: they type an email address and press send.
//
// At that moment we recompute their salted, daily-rotating visitor hash from the
// request's IP + user-agent — the SAME `deriveVisitor` the analytics beacon used
// when they landed, so the two definitions can never drift — look up that
// visitor's earliest pageview today, copy the DERIVED source / landing path /
// campaign onto the stage row, and THROW THE HASH AWAY.
//
// The hash is a lookup key and never a stored column (docs/128 §2, docs/151 §4).
// Storing it would freeze an identity designed to expire at UTC midnight, and
// that expiry is the property that keeps every sparx site free of a consent
// banner. There is deliberately no visitor-hash column on funnel_stage_events to
// put it in.
//
// This is `resolveOrderAttribution` (lib/attribution.ts) pointed at a person
// instead of an order, and the reasoning there applies here unchanged.
//
// ── AND WHAT IT MUST NEVER DO ───────────────────────────────────────────────
//
// Fail a capture. A funnel is a report; the lead is the business. So every entry
// point here swallows its own errors: the worst outcome is a stage row with no
// source on it, which reads honestly as "we do not know where they came from".
// Losing the address because a reporting nicety threw is not a trade anyone
// would make.

import type { FastifyBaseLogger } from 'fastify';
import { withTenant } from '@wizeworks/db';
import { FunnelRuleError, recordStage, stagesOf } from '@wizeworks/funnels';
import { announceStage } from '@wizeworks/funnels/announce';

import { deriveVisitor } from './site-analytics.js';

/** What a stage row can learn about where its subject came from. All three null
 *  is a real and common answer: a phone lead, a B2B rep, somebody who landed
 *  yesterday, or a visit the beacon never saw. */
export interface FunnelEntryFacts {
  entrySource: string | null;
  entryLandingPath: string | null;
  entryCampaign: string | null;
}

const NOTHING_KNOWN: FunnelEntryFacts = {
  entrySource: null,
  entryLandingPath: null,
  entryCampaign: null,
};

export interface ResolveFunnelEntryInput {
  tenantId: string;
  /** Client IP as api-rest resolved it (trustProxy) — the same input the beacon
   *  hashed, or the lookup silently matches nothing. */
  ip: string;
  /** Client user-agent, forwarded through the site proxy for the same reason. */
  userAgent: string;
  /** Capture time, and the UTC day the visitor hash rotates on. */
  now: Date;
}

/** UTC midnight of `now`. The hash already encodes the day, so any row carrying
 *  it is same-day by construction — bounding the scan just lets the
 *  (tenant_id, created_at, visitor_hash) index serve the lookup. */
function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Where this person came from, derived from their own traffic today.
 *
 * FIRST touch within the day, not last: it is the visit that ACQUIRED them
 * (docs/128 §3). Last-touch inside a single day mostly credits the tenant's own
 * site for a visitor it already had.
 *
 * Never throws. An unreadable answer and an absent one are the same thing to the
 * caller, and neither is worth failing a capture over.
 */
export async function resolveFunnelEntry(
  input: ResolveFunnelEntryInput
): Promise<FunnelEntryFacts> {
  const { tenantId, ip, userAgent, now } = input;
  try {
    const { visitorHash } = deriveVisitor(tenantId, ip, userAgent, now);

    const firstTouch = await withTenant({ tenantId }, (tx) =>
      tx.siteAnalyticsEvent.findFirst({
        where: {
          visitorHash,
          type: 'pageview',
          createdAt: { gte: startOfUtcDay(now) },
        },
        orderBy: { createdAt: 'asc' },
        select: { source: true, campaign: true, path: true },
      })
    );
    if (!firstTouch) return NOTHING_KNOWN;

    return {
      entrySource: firstTouch.source,
      // Only ever set on an email-source touch, which is what lets a funnel
      // report drill Email → per-campaign without a mapping table.
      entryCampaign: firstTouch.campaign,
      entryLandingPath: firstTouch.path,
    };
    // `visitorHash` goes out of scope here and is written nowhere. That is the
    // whole privacy contract, and it is one line of code.
  } catch {
    return NOTHING_KNOWN;
  }
}

export interface CaptureFunnelStageInput extends ResolveFunnelEntryInput {
  log: FastifyBaseLogger;
  funnelId: string;
  stageKey: string;
  /** Exactly one subject, the same exclusive-or `recordStage` and the table's
   *  CHECK constraint both enforce. */
  subjectEmail?: string;
  customerId?: string;
  /** Converting rung only, and NEVER from a public request body — see the
   *  collect route for why a visitor may not price their own conversion. */
  valueCents?: number;
  refs?: Record<string, string>;
}

/**
 * Resolve the entry facts and record one stage, best-effort.
 *
 * Returns whether a row was written, so a caller that wants to say "recorded"
 * can, but nothing here throws. A `FunnelRuleError` is logged at debug rather
 * than warn: "that funnel is paused" and "that key is not on this ladder" are
 * ordinary answers to a public request, not incidents.
 */
export async function captureFunnelStage(input: CaptureFunnelStageInput): Promise<boolean> {
  const { log, tenantId, funnelId, stageKey } = input;
  try {
    const entry = await resolveFunnelEntry(input);
    const row = await recordStage(
      { tenantId },
      {
        funnelId,
        stageKey,
        customerId: input.customerId,
        subjectEmail: input.subjectEmail,
        valueCents: input.valueCents,
        refs: input.refs,
        // Null and absent mean the same thing to a stage row (the column is
        // nullable and the input is optional), so the two vocabularies are
        // folded here rather than each caller remembering to.
        entrySource: entry.entrySource ?? undefined,
        entryLandingPath: entry.entryLandingPath ?? undefined,
        entryCampaign: entry.entryCampaign ?? undefined,
      }
    );
    await announceStage(log, tenantId, row);
    return true;
  } catch (err) {
    if (err instanceof FunnelRuleError) {
      log.debug({ funnelId, stageKey, reason: err.message }, 'funnel stage refused');
    } else {
      log.warn({ err, funnelId, stageKey }, 'funnel stage capture failed');
    }
    return false;
  }
}

/** A live funnel and the rung a capture lands on. */
export interface FunnelCaptureTarget {
  funnelId: string;
  stageKey: string;
}

/**
 * The active funnel this form feeds, and which rung its submission is.
 *
 * Matched on `(property, entry_form_node_id)`: builder node ids carry a random
 * base and are globally unique, so the node id alone is already specific and the
 * property scope makes it exact.
 *
 * The rung is the ladder's FIRST `capture` stage, not a configured one. A
 * `capture` rung is defined as the first place a named person exists, a ladder
 * is validated to be a sequence, and a form submission is exactly that moment —
 * so asking the tenant to also pick the stage would be asking them to restate
 * something the ladder already says, with a way to get it wrong.
 *
 * Returns null for anything unclear (no funnel, not active, no capture rung, an
 * unparseable ladder), because this runs beside a submission that has already
 * been stored and must not disturb it.
 */
export async function findFormCaptureTarget(
  tenantId: string,
  propertyId: string,
  formNodeId: string
): Promise<FunnelCaptureTarget | null> {
  try {
    const funnel = await withTenant({ tenantId }, (tx) =>
      tx.funnel.findFirst({
        where: { propertyId, entryFormNodeId: formNodeId, status: 'active' },
        orderBy: { updatedAt: 'desc' },
      })
    );
    if (!funnel) return null;

    const capture = stagesOf(funnel).find((s) => s.kind === 'capture');
    return capture ? { funnelId: funnel.id, stageKey: capture.key } : null;
  } catch {
    return null;
  }
}

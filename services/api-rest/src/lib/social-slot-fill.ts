// The evergreen slot filler (docs/social-audit/01-roadmap.md slice 17).
//
// The problem it solves is the one every small business has with social: they post three
// times in a good week and then nothing for a month, because posting is the thing that
// loses to actual work. A cadence of empty slots doesn't fix that on its own — someone
// still has to fill them.
//
// So: a tenant marks the posts they'd be happy to run again as EVERGREEN (a product they
// always sell, an explainer, a testimonial), and the slots they want covered as
// auto-fill. This tick keeps those slots from going quiet — it takes the
// least-recently-used evergreen post and schedules a fresh copy into the next empty one.
//
// Three rules keep it from being creepy:
//   · It only touches slots the tenant explicitly marked `auto_fill`. A plan-only slot
//     draws the gap on the calendar and is never filled behind their back.
//   · It never fills a slot that already has something in it — a real post the person
//     wrote always wins over a recycled one.
//   · It respects the approval gate exactly like every other path. With approval on, an
//     auto-filled post lands in the inbox for a human, not on the live account.
//
// Everything it creates is a NORMAL post: visible on the calendar, editable, deletable,
// with `source='evergreen'` so its origin is legible. Nothing about it is special-cased
// downstream.

import { ADVISORY_LOCKS, prisma, withAdvisoryTickLock, withTenant } from '@sparx/db';
import type { FastifyBaseLogger } from 'fastify';
import { publish } from '@sparx/api-core/pubsub';
import { nextSlotOccurrence } from '@sparx/social';
import { getSocialSettings } from '@sparx/social/service';

const DEFAULT_INTERVAL_MS = 15 * 60_000;

/** How far ahead a slot is filled. Long enough that a person sees next week's plan and
 *  can override it; short enough that they aren't looking at a month of robot posts. */
const LOOKAHEAD_DAYS = 8;

/** A post already scheduled within this window of a slot counts as filling it. Slots are
 *  a rhythm, not a stopwatch — two posts twenty minutes apart is one post's worth of
 *  attention, and scheduling both would read as a glitch. */
const OCCUPIED_WINDOW_MINUTES = 90;

interface AutofillSlot {
  id: string;
  tenant_id: string;
  property_id: string | null;
  weekday: number;
  minute_of_day: number;
  timezone: string;
  target_ids: string[];
}

export interface SlotFillResult {
  acquired: boolean;
  filled: number;
  errors: number;
}

const SKIPPED: SlotFillResult = { acquired: false, filled: 0, errors: 0 };

export async function runSocialSlotFillTick(logger: FastifyBaseLogger): Promise<SlotFillResult> {
  return withAdvisoryTickLock(ADVISORY_LOCKS.SOCIAL_SLOT_FILL, SKIPPED, async () => {
    const slots = await prisma.$queryRaw<AutofillSlot[]>`
      SELECT id, tenant_id, property_id, weekday, minute_of_day, timezone, target_ids
      FROM find_social_autofill_slots(500)
    `;
    if (slots.length === 0) return { acquired: true, filled: 0, errors: 0 };

    const now = new Date();
    let filled = 0;
    let errors = 0;

    // One settings read per tenant, not per slot — the approval default is the same
    // across a tenant's slots and it is a DB round trip.
    const approvalByTenant = new Map<string, boolean>();

    for (const slot of slots) {
      try {
        const when = nextSlotOccurrence(
          {
            weekday: slot.weekday,
            minuteOfDay: slot.minute_of_day,
            timezone: slot.timezone,
          },
          now,
          LOOKAHEAD_DAYS
        );
        if (!when) continue;

        if (!approvalByTenant.has(slot.tenant_id)) {
          const settings = await getSocialSettings(slot.tenant_id);
          approvalByTenant.set(slot.tenant_id, settings.requireApproval);
        }
        const requireApproval = approvalByTenant.get(slot.tenant_id) ?? true;

        const created = await fillSlot(slot, when, requireApproval);
        if (!created) continue;

        filled += 1;
        logger.info(
          { slotId: slot.id, postId: created.postId, scheduledAt: when.toISOString() },
          'social-slot-fill: scheduled an evergreen post into an empty slot'
        );
        if (created.status === 'scheduled') {
          await publish(logger, 'social.post.scheduled', slot.tenant_id, null, {
            postId: created.postId,
            scheduledAt: when.toISOString(),
          });
        }
      } catch (err) {
        errors += 1;
        logger.error({ err, slotId: slot.id }, 'social-slot-fill: failed to fill slot');
      }
    }

    return { acquired: true, filled, errors };
  });
}

/**
 * Fill one slot, if it is empty and there is anything in the pool to fill it with.
 * Returns null when the slot is already covered or the pool is dry — both ordinary,
 * neither an error.
 *
 * The whole thing rides one transaction under the tenant policy so two pods can't fill
 * the same slot twice (the occupancy check and the insert have to be atomic; the
 * advisory lock already makes that near-impossible, but "near" is not a guarantee worth
 * betting a duplicate public post on).
 */
async function fillSlot(
  slot: AutofillSlot,
  when: Date,
  requireApproval: boolean
): Promise<{ postId: string; status: string } | null> {
  const windowMs = OCCUPIED_WINDOW_MINUTES * 60_000;
  const windowStart = new Date(when.getTime() - windowMs);
  const windowEnd = new Date(when.getTime() + windowMs);

  return withTenant({ tenantId: slot.tenant_id }, async (tx) => {
    // Already covered? A human's post always wins.
    const occupant = await tx.socialPost.findFirst({
      where: {
        propertyId: slot.property_id,
        scheduledAt: { gte: windowStart, lte: windowEnd },
        status: { in: ['scheduled', 'pending_approval', 'publishing', 'published'] },
      },
      select: { id: true },
    });
    if (occupant) return null;

    // The least-recently-used evergreen post that actually went out at least once —
    // recycling something that has never successfully published would re-run a failure.
    const source = await tx.socialPost.findFirst({
      where: {
        evergreen: true,
        propertyId: slot.property_id,
        status: { in: ['published', 'partially_published'] },
      },
      orderBy: [{ lastRecycledAt: { sort: 'asc', nulls: 'first' } }, { publishedAt: 'asc' }],
      select: { id: true, body: true, link: true, mediaAssetIds: true, sourceRef: true },
    });
    if (!source) return null;

    // Only destinations that still exist and are still on. A slot pointing at a
    // disconnected Page fills with whatever is left, rather than failing outright.
    const targets = await tx.socialTarget.findMany({
      where: { id: { in: slot.target_ids }, enabled: true },
      select: { id: true, name: true, platform: true },
    });
    if (targets.length === 0) return null;

    const status = requireApproval ? 'pending_approval' : 'scheduled';
    const post = await tx.socialPost.create({
      data: {
        tenantId: slot.tenant_id,
        propertyId: slot.property_id,
        body: source.body,
        link: source.link,
        mediaAssetIds: source.mediaAssetIds,
        // `evergreen: false` on the copy, deliberately: the POOL entry is the original.
        // A copy that re-entered the pool would let one post crowd out every other.
        evergreen: false,
        source: 'evergreen',
        sourceRef: source.id,
        status,
        scheduledAt: when,
        targets: {
          create: targets.map((t) => ({
            tenantId: slot.tenant_id,
            socialTargetId: t.id,
            targetName: t.name,
            platform: t.platform,
            status: 'pending',
          })),
        },
      },
      select: { id: true },
    });

    // Move the source to the back of the queue so the pool rotates.
    await tx.socialPost.update({
      where: { id: source.id },
      data: { lastRecycledAt: new Date() },
    });

    return { postId: post.id, status };
  });
}

/** Background loop; returns stop() for graceful shutdown. Mirrors the other social
 *  ticks — drifts on a long run, since overlapping ticks would contend for the lock. */
export function startSocialSlotFillLoop(
  logger: FastifyBaseLogger,
  intervalMs: number = DEFAULT_INTERVAL_MS
): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async () => {
    if (stopped) return;
    try {
      await runSocialSlotFillTick(logger);
    } catch (err) {
      logger.error({ err }, 'social-slot-fill: tick threw — will retry next interval');
    }
    if (stopped) return;
    timer = setTimeout(() => void tick(), intervalMs);
  };

  timer = setTimeout(() => void tick(), intervalMs);
  logger.info({ intervalMs }, 'social-slot-fill: loop started');

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    logger.info('social-slot-fill: loop stopped');
  };
}

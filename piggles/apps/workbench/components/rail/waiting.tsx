'use client';

// How many things are WAITING — on one screen, on the app above it, and on the
// group above that.
//
// ── WHAT AN INDICATOR MEANS ─────────────────────────────────────────────────
//
// It is a claim that something needs doing. It is never a count of what is in a
// list: a group heading briefly wore "3" meaning "three apps live here", which
// reads identically to Sell's "2" meaning "two orders are waiting" and means
// something completely different. A number on a nav row has exactly one job.
//
// ── THE COUNT BELONGS TO A SCREEN, AND ROLLS UP FROM THERE ──────────────────
//
// Every count is really a fact about ONE screen — orders waiting to go out is a
// fact about Orders, not about Sell. So the screen owns it, the section sums
// its screens, the app sums its sections, and the group sums its apps. One number, three levels, and the levels
// cannot disagree because the two upper ones are derived rather than declared.
//
// The rollup is over the surfaces this person can actually REACH, which is what
// makes it honest for a restricted teammate: somebody who cannot open Orders
// does not get an app badge counting them.
//
// A folded group hides its rows, so the heading carries the total folded or
// open — folded because you cannot see the rows, open because a total that
// vanishes when you expand is a different answer to the same question.
//
// ── ONLY REAL, MEASURED, NON-ZERO ───────────────────────────────────────────
//
// Loading, failed, unmeasured and zero all render NOTHING. A skeleton in a 20px
// slot is a flicker; a red pip reports a failed COUNT as a business problem; and
// a grey 0 on every row trains people to stop reading the rows that matter.

import { Badge } from '@wizeworks/silicaui-react';
import { COUNT_SURFACE, type useAttention, type AttentionKey } from '@/lib/console/home-data';
import type { SurfaceDefinition } from '@/lib/surfaces/registry';
import type { ConsoleNavApp } from '@/lib/console/nav';

type Attention = ReturnType<typeof useAttention>;

/** Inverted from COUNT_SURFACE, never re-typed — a second copy of that mapping
 *  is a second thing to keep in step. A surface with no entry never badges,
 *  which is the right default: most screens are not queues. */
const SURFACE_COUNTS = new Map<string, AttentionKey>(
  (Object.entries(COUNT_SURFACE) as [AttentionKey, string][]).map(([key, surface]) => [
    surface,
    key,
  ])
);

/** What is waiting on one screen, or null when there is no honest number. */
export function surfaceWaiting(surfaceKey: string, attention: Attention): number | null {
  const key = SURFACE_COUNTS.get(surfaceKey);
  if (!key) return null;
  const count = attention[key];
  if (count.state !== 'ready' || !count.value) return null;
  return count.value;
}

/** What is waiting inside one SECTION of a panel — the sum of its screens.
 *
 *  The level that was missing. A folded section hid its rows and had nothing to
 *  say in their place, so it briefly wore how many rows it held — a list length,
 *  in the slot this whole file exists to reserve for things that need doing. */
export function sectionWaiting(
  surfaces: readonly SurfaceDefinition[],
  attention: Attention
): number | null {
  const total = surfaces.reduce(
    (sum, surface) => sum + (surfaceWaiting(surface.key, attention) ?? 0),
    0
  );
  return total > 0 ? total : null;
}

/** What is waiting across one app — the sum of its sections, which are the sum
 *  of their screens. Composed rather than re-summed, so the two levels cannot
 *  disagree. */
export function appWaiting(entry: ConsoleNavApp, attention: Attention): number | null {
  const total = entry.sections.reduce(
    (sum, section) => sum + (sectionWaiting(section.surfaces, attention) ?? 0),
    0
  );
  return total > 0 ? total : null;
}

/** What is waiting across a group — the sum of its apps. */
export function groupWaiting(apps: ConsoleNavApp[], attention: Attention): number | null {
  const total = apps.reduce((sum, entry) => sum + (appWaiting(entry, attention) ?? 0), 0);
  return total > 0 ? total : null;
}

/** The badge itself. `soft` because a solid pill on a nav row competes with the
 *  row's own selected state. */
export function WaitingBadge({ count }: { count: number | null }) {
  if (count === null) return null;
  return (
    <Badge color="module" variant="soft" size="sm">
      {count > 99 ? '99+' : count}
    </Badge>
  );
}

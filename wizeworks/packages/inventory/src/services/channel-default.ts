// Which location a sales channel ships from (persona issue 929).
//
// One answer, read by two callers that used to disagree. Postage, labels and
// returns take their ship-from address from `resolveDefaultWarehouseId`, and the
// Locations screen says which location that is. When the rule lived only in the
// resolver, it ended in `candidates[0]` of an UNORDERED query, so with no
// location named for the channel the ship-from was whichever row Postgres
// returned first, and nothing on screen could say which one it would be.
//
// Pure, so the order can be tested without a database.

import { isSampleRow } from '@wizeworks/db';

export interface ChannelCandidate {
  id: string;
  defaultForChannel: unknown;
  createdAt: Date;
  type: string;
  isSystem: boolean;
  metadata: unknown;
}

/** The kinds of place a parcel can leave from. A supplier's place and a
 *  place on paper only cannot hand anything to a courier. */
const PHYSICAL = new Set(['owned', '3pl']);

function namesChannel(candidate: ChannelCandidate, channel: string): boolean {
  return (
    Array.isArray(candidate.defaultForChannel) &&
    (candidate.defaultForChannel as unknown[]).includes(channel)
  );
}

/**
 * The location `channel` ships from, out of ACTIVE locations. In order:
 *
 *   1. one the owner named for the channel (the oldest, if somehow several);
 *   2. the oldest place of her own or a partner's that no sample pack added;
 *   3. the oldest location at all that the platform does not run itself;
 *   4. the oldest location at all.
 *
 * Null only when there is no active location.
 */
export function channelDefaultId(
  candidates: readonly ChannelCandidate[],
  channel: string
): string | null {
  const oldestFirst = [...candidates].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)
  );
  const pick =
    oldestFirst.find((c) => namesChannel(c, channel)) ??
    oldestFirst.find((c) => !c.isSystem && PHYSICAL.has(c.type) && !isSampleRow(c.metadata)) ??
    oldestFirst.find((c) => !c.isSystem) ??
    oldestFirst[0];
  return pick?.id ?? null;
}

/** What `channelDefaultId` needs from a warehouse row. */
export const CHANNEL_CANDIDATE_SELECT = {
  id: true,
  defaultForChannel: true,
  createdAt: true,
  type: true,
  isSystem: true,
  metadata: true,
} as const;

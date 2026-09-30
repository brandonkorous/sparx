// How old the scores on this list actually are (issue 872).
//
// The page list is a STORED SNAPSHOT. `seo_audits` rows are written by a rescan
// and read back unchanged, so a score can be any age at all: measured across the
// platform, **370 of 370 audits were more than a week old**, averaging 47 days
// and reaching 117.
//
// The toolbar's refresh control reported `dataUpdatedAt` — react-query's fetch
// time, which is when the BROWSER last asked. That is the right answer on an
// ordinary list, where the server's reply IS current, and it is what the shared
// `RefreshButton` documents itself as taking. On a snapshot it answers a
// different question from the one being asked, so a list of four-month-old
// scores read "updated a few seconds ago".
//
// Same shape as issue 463, where a nightly cache showed the fetch time and read
// "updated just now" over breakfast figures while `computed_at` had been written
// since it shipped and drawn by nobody. Here the server has always sent
// `computedAt` on every row, and the console's own `AuditRow` declares it
// REQUIRED.
//
// Two things make the age worth stating out loud rather than hiding in a
// tooltip:
//
//   1. The primary action on this toolbar is **Rescan the site**. The age of the
//      scores is the whole input to that decision.
//   2. Opening one page RE-SCORES it and re-stores the row, so the detail is
//      always live while the list is not. Without the age on screen, a fresh
//      detail disagreeing with a stale list looks like a bug in the score.
//
// Logic lives here rather than in the pane so it can be tested: a `.tsx` cannot
// be imported by vitest in this app (`jsx: preserve`).

/** After this, a rescan is the honest next step.
 *
 *  A week, because a score describes a page as it was when it was read, and a
 *  shop that edited a page last Tuesday should not be told its old score still
 *  applies. Nothing breaks at eight days; the sentence simply starts offering
 *  the remedy. */
export const STALE_AFTER_DAYS = 7;

const DAY_MS = 86_400_000;

export interface ScoreAge {
  /**
   * The OLDEST score on the list.
   *
   * A list is only as current as its oldest row, so this is what gets reported:
   * it can never claim the scores are fresher than they are. Leading with the
   * newest would let one rescan of one page speak for a hundred stale ones.
   */
  oldest: string;
  /** How many rows are past the threshold, and how many there are in total. */
  staleCount: number;
  total: number;
  /** True once the oldest row is past the threshold. */
  stale: boolean;
}

/**
 * What to say about the age of these scores, or null when there is nothing to
 * say.
 *
 * Null on an empty list (no scores, so no age) and on a row whose `computedAt`
 * cannot be read as a date — an unreadable stamp is not evidence of freshness,
 * and inventing "just now" from it is the bug this replaces.
 */
export function scoreAge(
  rows: readonly { computedAt?: string | null }[],
  now: number
): ScoreAge | null {
  // One pass, and no indexing: `stamps[0]` is `| undefined` under this
  // tsconfig, and reaching for it needs a guard that says nothing a reader
  // could not already see.
  const cutoff = now - STALE_AFTER_DAYS * DAY_MS;
  let oldest: { iso: string; at: number } | null = null;
  let total = 0;
  let staleCount = 0;

  for (const row of rows) {
    const iso = row.computedAt;
    if (iso === undefined || iso === null || iso === '') continue;
    const at = Date.parse(iso);
    if (!Number.isFinite(at)) continue;
    total += 1;
    if (at < cutoff) staleCount += 1;
    if (oldest === null || at < oldest.at) oldest = { iso, at };
  }

  if (oldest === null) return null;
  return { oldest: oldest.iso, staleCount, total, stale: oldest.at < cutoff };
}

/**
 * The sentence that follows the timestamp, or empty when none is needed.
 *
 * The timestamp itself is rendered by the shared `Timestamp` component rather
 * than formatted here: hand-rolling relative-time math is what that component
 * exists to prevent.
 */
export function scoreAgeAdvice(age: ScoreAge): string {
  if (!age.stale) return '';
  if (age.staleCount >= age.total) return 'Rescan to bring them up to date.';
  const n = age.staleCount;
  return `${String(n)} of ${String(age.total)} ${n === 1 ? 'is' : 'are'} more than a week old. Rescan to bring them up to date.`;
}

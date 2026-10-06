// THE WEEK, AS THE AVAILABILITY EDITOR HOLDS IT.
//
// Times are the `HH:MM` a time box speaks, and each block may carry the two
// season dates (see `season-window`). The rules live here rather than in the
// pane so they can be tested: a `.tsx` cannot be imported by vitest in this app
// (`jsx: preserve`).

import type { SeasonBounds } from './season-window';

/** One block of open hours on one day. */
export interface HoursBlock extends SeasonBounds {
  start: string;
  end: string;
}

/** The blocks for each day, keyed 0 = Sunday .. 6 = Saturday, as stored. */
export type WeekDraft = Record<number, HoursBlock[]>;

/** The hours a day gets when nothing better is known: 9 to 5. */
export const FALLBACK_BLOCK: HoursBlock = {
  start: '09:00',
  end: '17:00',
  validFrom: '',
  validTo: '',
};

/** The week in the order the editor lists it: Monday first, Sunday last. The
 *  same order as `WEEK_DAYS`, written out here so this file stays free of the
 *  data layer and can be tested on its own. */
export const WEEK_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0];

function copyOf(blocks: readonly HoursBlock[]): HoursBlock[] {
  return blocks.map((block) => ({ ...block }));
}

/**
 * The hours a day starts with when it is switched on.
 *
 * A shop that opens at 7:30 on Monday almost always opens at 7:30 on Tuesday,
 * so a day takes the hours of the nearest open day BEFORE it in the week as the
 * editor lists it. With nothing open before it, the nearest open day after it;
 * with nothing open at all, 9 to 5. It takes the whole day, so a split shift
 * and any season dates come along, and it takes copies, so changing the new day
 * never changes the day it came from (issue 086: every day used to start at
 * 9 to 5, and the owner retyped the same times four times).
 */
export function hoursForNewDay(week: WeekDraft, day: number): HoursBlock[] {
  const at = WEEK_ORDER.indexOf(day);
  if (at !== -1) {
    for (let index = at - 1; index >= 0; index -= 1) {
      const blocks = week[WEEK_ORDER[index] ?? -1] ?? [];
      if (blocks.length > 0) return copyOf(blocks);
    }
    for (let index = at + 1; index < WEEK_ORDER.length; index += 1) {
      const blocks = week[WEEK_ORDER[index] ?? -1] ?? [];
      if (blocks.length > 0) return copyOf(blocks);
    }
  }
  return [{ ...FALLBACK_BLOCK }];
}

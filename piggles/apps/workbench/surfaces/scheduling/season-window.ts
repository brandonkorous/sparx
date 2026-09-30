// HOURS THAT ONLY APPLY FOR PART OF THE YEAR.
//
// A weekly window can be bounded by two dates. The platform has supported this
// the whole time: `scheduling_availability_windows` carries `valid_from` and
// `valid_to`, `setAvailabilityWindows` writes them, the availability engine
// honours them (a day outside the range is skipped), the REST route serializes
// them, and the MCP tool's own description tells an assistant that
// "`validFrom`/`validTo` (YYYY-MM-DD) bound a seasonal schedule".
//
// Only the console was missing, and missing in the worst way. Its write shape had
// no room for the dates, and the server replaces the whole week on every save, so
// opening Availability and pressing Save DELETED any seasonal bound on any day —
// on a screen that had never shown her the dates existed. Measured 2026-09-28: 0
// of 236 stored windows carry a date, which is what you would expect when the one
// screen that edits them cannot hold them (issue 866).
//
// The rules live here rather than in the pane so they can be tested: a `.tsx`
// cannot be imported by vitest in this app (`jsx: preserve`).

/** The two dates on one block of hours. `YYYY-MM-DD`, or the empty string for
 *  "no limit at this end", which is the shape `DayInput` speaks. */
export interface SeasonBounds {
  validFrom: string;
  validTo: string;
}

/** Whether this block is limited to part of the year at either end. */
export function hasSeason(bounds: SeasonBounds): boolean {
  return bounds.validFrom !== '' || bounds.validTo !== '';
}

/** Whether any block in the week is. What decides the switch's starting state,
 *  so a seasonal week she set through her assistant opens as one. */
export function anySeason(windows: readonly SeasonBounds[]): boolean {
  return windows.some(hasSeason);
}

/**
 * Whether the two dates describe a range that can ever happen.
 *
 * One date alone is fine and means open-ended at that end. Both set means the
 * later must not come first: the engine skips a day before `validFrom` and a day
 * after `validTo`, so a range that runs backwards matches NOTHING and the block
 * silently never applies. That is the one arrangement worth refusing at the door
 * rather than saving and letting her wonder why nobody can book.
 *
 * Dates are `YYYY-MM-DD`, so comparing the strings compares the days. That holds
 * only for this fixed-width, big-endian format, which is the format the wire and
 * `DayInput` both use.
 */
export function seasonValid(bounds: SeasonBounds): boolean {
  if (bounds.validFrom === '' || bounds.validTo === '') return true;
  return bounds.validFrom <= bounds.validTo;
}

/** The two dates as the WIRE carries them: `null` means no limit at that end. */
export interface SeasonWire {
  validFrom: string | null;
  validTo: string | null;
}

/**
 * The wire's dates, as the editor holds them.
 *
 * Half of the round trip that regressed. The wire says `null` for "no limit" and
 * `DayInput` says the empty string, and the whole defect was that the editor's
 * write shape had nowhere to put either.
 */
export function seasonFromWire(wire: SeasonWire): SeasonBounds {
  return { validFrom: wire.validFrom ?? '', validTo: wire.validTo ?? '' };
}

/** The editor's dates, as the wire wants them. The other half. */
export function seasonToWire(bounds: SeasonBounds): SeasonWire {
  return {
    validFrom: bounds.validFrom === '' ? null : bounds.validFrom,
    validTo: bounds.validTo === '' ? null : bounds.validTo,
  };
}

/** Clear both ends. What turning the switch off does to one block. */
export function withoutSeason<T extends SeasonBounds>(window: T): T {
  return { ...window, validFrom: '', validTo: '' };
}

/**
 * The sentence under the switch.
 *
 * Three states, and the third is the one that matters: she has seasonal hours
 * and has just turned the switch off, so Save is about to remove them. Saying so
 * before she saves is the difference between an explicit choice and the silent
 * deletion this issue was about.
 */
export function seasonHelp(seasonal: boolean, storedIsSeasonal: boolean): string {
  if (seasonal) {
    return 'Each block of hours can be limited to part of the year. Leave a date empty for no limit at that end.';
  }
  if (storedIsSeasonal) {
    return 'The same hours every week, all year. Saving now will remove the dates already set on this week.';
  }
  return 'The same hours every week, all year.';
}

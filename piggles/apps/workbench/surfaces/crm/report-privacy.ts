// A report kept to the person who made it, as boards show it (persona issue 264).

import type { SavedReport } from './report-builder-types';

/** Kept to its maker, rather than shared or one of the business's own. */
export function keptToItsMaker(report: Pick<SavedReport, 'shared' | 'ownerId'>): boolean {
  return !report.shared && report.ownerId !== null;
}

/** What a teammate's board card says in place of a report kept private. */
export const PRIVATE_CARD_WORDS =
  'This card shows a report kept private by the person who made it.';

/** What adding a private report to a shared board says first. */
export const PRIVATE_ON_SHARED_WARNING =
  'This report is kept to you, so teammates who open this board will see its card but not its name or numbers.';

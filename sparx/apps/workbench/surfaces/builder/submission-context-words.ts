// WHAT "WHERE THIS CAME FROM" IS ALLOWED TO SAY.
//
// The form-reply pane captures a little request context with every message and
// prints it under friendly labels. The labels were friendly; the values were not:
//
//     Their IP address    ::1
//     Their browser       Mozilla/5.0 (Windows NT 10.0; Win64; x64)
//                         AppleWebKit/537.36 (KHTML, like Gecko)
//                         Chrome/151.0.0.0 Safari/537.36
//
// Measured 2026-09-17: 7 of the 7 form submissions on the platform carry an
// address that means "nowhere was recorded", and all 7 carry a raw agent string.
// So on every one of them, both rows were noise — and the first was worse than
// noise, because a label reading "Their IP address" over a placeholder presents
// it as evidence about a stranger ([[feedback_never_present_absence_as_measurement]]).
//
// Both answers already existed, tested, one folder away in `security/`, where
// the Devices card asks the same two questions about the same two fields. They
// were written for that card and not for this pane
// ([[feedback_a_fix_leaves_its_neighbour_behind]], issue 628).

import { describeDevice, whereFrom } from '../security/where-from-words';
import { humanizeKey } from './form-submissions-data';

/** One line under "Where this came from". */
export interface ContextRow {
  label: string;
  value: string;
}

/**
 * Friendly labels for the captured request context, in the words a business
 * owner reads rather than the raw technical key. Anything unmapped falls back to
 * a humanised key, so a future context field still shows up — just less
 * prettily.
 */
const LABELS: Record<string, string> = {
  referrer: 'Page they came from',
  userAgent: 'Their browser',
  ip: 'Their IP address',
};

/** Keys the card draws for itself further up, so they are not said twice. */
const ALREADY_SAID = new Set(['submittedAt']);

/**
 * One context entry as a line, or null when there is nothing worth showing.
 *
 * `format` renders the leftover kinds (dates, numbers, nested objects) and is
 * the caller's, because it needs the shop's clock.
 */
export function contextRow(
  key: string,
  value: unknown,
  format: (key: string, value: unknown) => string
): ContextRow | null {
  if (ALREADY_SAID.has(key)) return null;

  // A placeholder address is not a place. `whereFrom` returns null for every
  // value some layer writes when it has nothing to write, and a row that would
  // read "Their IP address · nothing" is better not drawn at all.
  if (key === 'ip') {
    const from = whereFrom(typeof value === 'string' ? value : null);
    return from === null ? null : { label: LABELS.ip ?? 'Their IP address', value: from };
  }

  // "Chrome on Windows", or an honest "Unknown device". Never the raw string.
  if (key === 'userAgent') {
    return {
      label: LABELS.userAgent ?? 'Their browser',
      value: describeDevice(typeof value === 'string' ? value : null),
    };
  }

  const text = format(key, value);
  return text.trim() === '' ? null : { label: LABELS[key] ?? humanizeKey(key), value: text };
}

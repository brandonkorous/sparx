// What a count can honestly SAY about itself — the one summary line under its
// name, and the money column beside it.
//
// ── Zero is two opposite answers ─────────────────────────────────────────
//
// `varianceValueCents` is Σ |counted − expected| × unit cost. Cost is optional
// and nothing ever asks for it, so a shop that has never entered one gets zero
// out of that sum no matter how much stock moved — Devi counted 372 garments
// into an empty shop and the list reported the whole thing as $0.00 (issue 175).
//
// "$0.00" is the exact reading of a count that found nothing wrong, which is the
// glance-and-move-on case. Printed over the largest stock event in a shop's
// history it is not a rounding problem, it is the wrong sentence. The unit count
// is what separates the two, so every function here reads units BEFORE money.

import { formatCents, plural } from './data';
import type { CountRow } from './counts-data';

/** Nothing moved, or nothing has a cost to value it with? */
export function anyUnpriced(counts: CountRow[]): boolean {
  return counts.some(movedButUnpriced);
}

function movedButUnpriced(count: CountRow): boolean {
  return count.varianceValueCents === 0 && count.varianceUnits > 0;
}

/**
 * The money column.
 *
 * Two states have no difference to report at all rather than a difference of
 * zero, and both show a dash: a count still being COUNTED has no frozen value
 * yet, and a DISCARDED one was closed without applying anything. "$0.00" on
 * either reads as "we checked and it all matched", which is a different and
 * much more reassuring claim than "we never finished".
 */
export function differenceLabel(count: CountRow): string {
  if (count.status === 'counting' || count.status === 'cancelled') return '—';
  if (movedButUnpriced(count)) return 'No cost yet';
  return formatCents(count.varianceValueCents);
}

/** The same fact in a sentence, for the narrow layout and screen readers. Kept
 *  short: at 360px this line is the ONLY place these numbers appear, and a
 *  sentence that runs past two lines gets clipped where it matters. */
export function differenceSentence(count: CountRow): string {
  const units = plural(count.varianceUnits, 'unit', 'units');
  if (movedButUnpriced(count)) return `${units} different, no cost recorded`;
  return `differences worth ${formatCents(count.varianceValueCents)}`;
}

/**
 * The one summary line a card carries, tuned to what matters at each stage:
 * progress while counting, the value of the differences once counted, what was
 * corrected once applied.
 */
export function summaryLine(count: CountRow): string {
  const items = plural(count.lineCount, 'item', 'items');
  switch (count.status) {
    case 'counting':
      return `${String(count.countedLineCount)} of ${items} counted`;
    case 'review':
    case 'approved':
      if (count.varianceUnits === 0) return `${items} counted · everything matched`;
      return `${items} counted · ${differenceSentence(count)}`;
    case 'posted':
      if (count.varianceUnits === 0) return `${items} · everything matched, nothing to correct`;
      if (movedButUnpriced(count)) {
        return `${items} · ${plural(count.varianceUnits, 'unit', 'units')} corrected, no cost recorded`;
      }
      return `${items} · ${formatCents(count.varianceValueCents)} of corrections applied`;
    case 'cancelled':
      return `${items} · discarded without changing any stock`;
    default:
      return items;
  }
}

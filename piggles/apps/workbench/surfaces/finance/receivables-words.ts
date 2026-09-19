// How late one invoice is, in words and in color.
//
// Aging IS the "Owed to you" surface: the same balance reads very differently at
// "due next week" and "90 days late", so this one label carries the urgency, the
// row color and the default sort order. Lifted out of the pane so the awkward
// case below can be tested, and so the two consoles cannot drift apart on it
// again — one of them had the no-date branch and the other never got it, which
// is exactly the kind of gap a shared, tested module closes.

export type ReceivableBucketKey = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus';

export type LatenessTone = 'success' | 'warning' | 'error' | 'info';

/** The three fields lateness is decided from. Narrower than `Receivable` on
 *  purpose, so the words can be tested without the data layer. */
export interface LatenessInput {
  dueAt: string | null;
  overdueDays: number;
  bucket: ReceivableBucketKey;
}

/** The color a lateness bucket wears — the whole point of the surface is that a
 *  90-days-late balance does not look like a not-yet-due one. */
export function bucketTone(key: ReceivableBucketKey): LatenessTone {
  switch (key) {
    case 'current':
      return 'info';
    case 'd1_30':
      return 'warning';
    case 'd31_60':
    case 'd61_90':
      return 'error';
    case 'd90_plus':
      return 'error';
  }
}

/**
 * How late this invoice is, in plain words + its semantic tone.
 *
 * THE NO-DATE CASE IS THE ONE THAT MATTERS. "Not yet due" is a claim about a
 * DEADLINE. An invoice with no due date has none, so saying it is not yet due
 * tells her the money is fine when nobody ever established when it stops being
 * fine: it can never enter an aging bucket, never turn red, and never reach the
 * chase list. `overdueDays` is 0 for both cases, which is exactly why they have
 * to be told apart here and not by the number.
 */
export function lateness(r: LatenessInput): { label: string; tone: LatenessTone } {
  if (!r.dueAt) {
    return { label: 'No date agreed', tone: 'warning' };
  }
  if (r.overdueDays <= 0) {
    return { label: 'Not yet due', tone: 'info' };
  }
  const days = r.overdueDays;
  return {
    label: days === 1 ? '1 day late' : `${String(days)} days late`,
    tone: bucketTone(r.bucket),
  };
}

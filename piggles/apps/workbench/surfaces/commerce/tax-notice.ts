// What the banner above the tax places is allowed to say.
//
// ---------------------------------------------------------------------------
// The bug this exists for
// ---------------------------------------------------------------------------
//
// Juniper Row collects tax in Colorado. She switched it on herself; the zone
// carries `is_active` and an `activated_at`, and the row on screen says
// "Collecting". Above that row the screen said:
//
//     Set up, but charging nothing
//     Tax is worked out and added at checkout. Every place starts switched off,
//     so nothing is charged before you have looked at it.
//
// She is charging. The gate was right and the sentence was not: it fires on
// `rows.some(has a rate && not collecting)`, which is true the moment ANY place
// is silent, and the title then reports that as "nothing".
//
// The two states need two sentences, because they call for opposite actions:
//
//   nothing is on          -> no tax is reaching any checkout; this is urgent
//   some on, some off      -> tax IS being charged; the question is only whether
//                             the silent ones should be too
//
// Telling the second shop it charges nothing invites the worst reading
// available: that the Colorado tax she can see on the screen is not really being
// collected, and does not need remitting.
//
// ---------------------------------------------------------------------------
// Measured
// ---------------------------------------------------------------------------
//
// Ten tenants have a tax place with a rate on it. Nine are charging nowhere, so
// the old title was true for them. The tenth is Juniper Row, the only one who
// has switched anything on -- which is to say the sentence was wrong for exactly
// the shop that had done what it asked. Every other tenant inherits the same
// wrong sentence the moment they comply.

/** The banner, or `null` when there is nothing worth saying. */
export interface TaxSilenceNotice {
  title: string;
  detail: string;
}

/**
 * `silent` is how many places carry a rate and are not collecting; `collecting`
 * is how many are. Places with no rate at all are not counted either way: a
 * brand-new shop is seeded one empty country place, and warning its owner that
 * their tax is not working would be a warning about nothing.
 */
export function taxSilenceNotice(silent: number, collecting: number): TaxSilenceNotice | null {
  if (silent <= 0) return null;

  const places = silent === 1 ? 'place' : 'places';

  if (collecting === 0) {
    return {
      title: 'Set up, but charging nothing',
      detail:
        'Tax is worked out and added at checkout. Every place starts switched off, so nothing is charged before you have looked at it. Open each place you are registered to collect in, check its rate, then switch it on. If you are not sure where you have to collect, ask an accountant.',
    };
  }

  return {
    title: `${String(silent)} ${places} set up but switched off`,
    detail:
      `You are charging tax in ${String(collecting)} ${collecting === 1 ? 'place' : 'places'}, so tax is reaching your checkout. ` +
      `${String(silent)} other ${places} ${silent === 1 ? 'has' : 'have'} a rate set and ${silent === 1 ? 'is' : 'are'} not collecting. ` +
      'Open each one you are registered in, check its rate, then switch it on. If you are not sure where you have to collect, ask an accountant.',
  };
}

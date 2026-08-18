import 'server-only';
import { SAMPLE_DATA_PACKS } from '@wizeworks/db';

// A "trade" is the line of work a business is in — the platform calls it
// `settings.industry`, and one slug does two jobs downstream: it picks the
// sample dataset AND the config presets the platform stamps.
//
// Validated against the packs that ACTUALLY EXIST rather than a list kept here.
// A slug with no pack behind it does not fail — it quietly resolves to the
// generic dataset — so an unrecognised value would be a bakery handed generic
// data with nothing anywhere reporting it. Null is the honest answer for
// "unrecognised", and the platform already reads null as "use the generic set".

export function isKnownTrade(value: string): boolean {
  return Object.hasOwn(SAMPLE_DATA_PACKS, value);
}

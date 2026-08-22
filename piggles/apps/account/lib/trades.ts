import 'server-only';
import { SAMPLE_DATA_PACKS } from '@wizeworks/db';
import { GENERIC_TRADE, TRADE_LABELS, TRADE_ORDER, type TradeOption } from './trade-options';

// A "trade" is the line of work a business is in — the platform calls it
// `settings.industry`, and one slug does two jobs downstream: it picks the
// sample dataset AND the config presets the platform stamps.
//
// Both functions here read the packs that ACTUALLY EXIST rather than a list kept
// alongside. A hand-kept list drifts silently in BOTH directions and neither
// direction reports itself: a slug with no pack behind it resolves to the
// generic dataset, and a pack nobody offers is simply unreachable — which is
// what happened to the florist pack and its starter, advertised by name on the
// signup screen and missing from the picker (issue #001).

export function isKnownTrade(value: string): boolean {
  return Object.hasOwn(SAMPLE_DATA_PACKS, value);
}

/**
 * Every trade the platform can actually furnish, in the order we offer them.
 *
 * A pack we have not named yet is offered under its OWN label rather than
 * dropped, so the eleventh pack is reachable the day it lands and reads a little
 * like a catalogue until somebody writes it a better name.
 */
export function tradeOptions(): TradeOption[] {
  const available = Object.keys(SAMPLE_DATA_PACKS).filter((slug) => slug !== GENERIC_TRADE);
  const named = TRADE_ORDER.filter((slug) => available.includes(slug));
  const rest = available.filter((slug) => !named.includes(slug)).sort();
  return [...named, ...rest, GENERIC_TRADE]
    .filter((slug) => Object.hasOwn(SAMPLE_DATA_PACKS, slug))
    .map((slug) => ({
      value: slug,
      label: TRADE_LABELS[slug] ?? SAMPLE_DATA_PACKS[slug]!.label,
    }));
}

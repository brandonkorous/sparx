import { GENERIC_TRADE, TRADE_LABELS, TRADE_ORDER, type TradeOption } from './trade-options';

// A "trade" is the line of work a business is in — the platform calls it
// `settings.industry`, and one slug does two jobs downstream: it picks the
// sample dataset AND the config presets the platform stamps.
//
// This reads the packs that ACTUALLY EXIST (api-rest holds them) rather than a
// list kept alongside. A hand-kept list drifts silently in BOTH directions and
// neither direction reports itself: a slug with no pack behind it resolves to
// the generic dataset, and a pack nobody offers is simply unreachable — which
// is what happened to the florist pack and its starter, advertised by name on the
// signup screen and missing from the picker (issue #001).

/**
 * Every trade the platform can actually furnish, in the order we offer them.
 *
 * `industries` is api-rest's list of the sample packs it holds, or null when it
 * could not be asked: then the trades Piggles names are offered, and furnishing
 * ignores any it cannot furnish. A pack we have not named yet is offered under
 * its OWN label rather than dropped, so the eleventh pack is reachable the day
 * it lands and reads a little like a catalogue until somebody writes it a
 * better name.
 */
export function tradeOptions(industries: { key: string; label: string }[] | null): TradeOption[] {
  const packs = new Map(
    (industries ?? [...TRADE_ORDER, GENERIC_TRADE].map((key) => ({ key, label: key }))).map(
      (i) => [i.key, i.label] as const
    )
  );
  const available = [...packs.keys()].filter((slug) => slug !== GENERIC_TRADE);
  const named = TRADE_ORDER.filter((slug) => available.includes(slug));
  const rest = available.filter((slug) => !named.includes(slug)).sort();
  return [...named, ...rest, GENERIC_TRADE]
    .filter((slug) => packs.has(slug))
    .map((slug) => ({ value: slug, label: TRADE_LABELS[slug] ?? packs.get(slug)! }));
}

// What we CALL each trade, and the order we offer them in.
//
// Deliberately not in `trades.ts`, which is `server-only` because it reads the
// sample-data packs. That file answers "which trades exist"; this one answers
// "what do we call them and which comes first" — and it stays free of the db
// package so the labels can also be read in the browser.
//
// The KEYS are the real pack slugs (`settings.industry`) and must stay that way:
// a key with no pack behind it is simply never offered, and a pack with no key
// here is offered under the pack's own name rather than vanishing (see
// `tradeOptions`). That is the whole point of the split — the list of trades is
// the platform's, and this file only dresses it.
//
// The labels are ours. The packs call themselves things like "Apparel & fashion"
// and "Generic starter", which is a catalogue talking about itself; a person
// picking their own trade off a list should read words they would use about
// their own business (RULE #3).
export const TRADE_LABELS: Record<string, string> = {
  food: 'Food & drink',
  salon: 'Beauty & salon',
  florist: 'Flowers & plants',
  apparel: 'Clothing & accessories',
  professional: 'Professional services',
  fitness: 'Fitness & wellbeing',
  'auto-parts': 'Car parts & repair',
  electronics: 'Electronics & tech',
  wholesale: 'Wholesale & trade supply',
  generic: 'Something else',
};

/** Offered in this order — by how likely somebody is to find themselves in it.
 *  Anything not named here follows, and the catch-all is forced last. */
export const TRADE_ORDER: string[] = [
  'food',
  'salon',
  'florist',
  'apparel',
  'professional',
  'fitness',
  'auto-parts',
  'electronics',
  'wholesale',
];

/** The catch-all, which belongs at the bottom of the list wherever it is built. */
export const GENERIC_TRADE = 'generic';

export interface TradeOption {
  value: string;
  label: string;
}

import type { BlueprintChoice } from './furnish';

// Which templates a trade is offered, and in what order.
//
// ── WHY THIS IS NOT JUST A FILTER ───────────────────────────────────────────
//
// The catalog carries 169 templates and files each under one of four broad
// verticals (retail · services · content · b2b). Ranking on the vertical ALONE,
// then taking the first five in catalog order, is what this used to do, and on
// screen it produced this:
//
//   Marisol picks "Food & drink" for a bakery and is offered a luxury skincare
//   brand, an athletic-apparel brand and a stationery shop.
//
// Two separate faults, both visible to the owner (issue #007):
//
//   1. **Nine trades collapsed to three shelves.** food and apparel got the
//      identical five; salon, professional, fitness and auto-parts got another
//      identical five — so a garage, a gym and an accountant were all shown a
//      barber and a bistro.
//   2. **The right template was unreachable.** `restaurant-cafe` — a bakery and
//      counter café, which is exactly Thistle & Rye — is filed under `services`,
//      so a `food` business on the `retail` shelf could never be shown it. Of
//      sixteen food templates in the catalog, a food business saw one, last.
//
// So the vertical stops being a gate and becomes one signal among three. What
// actually decides the order is whether the template is ABOUT this trade, which
// its key, name and summary say plainly in words.

/** The broad shelf a trade sits on. Now a nudge, not a filter — a template off
 *  this shelf still ranks if it is obviously about the trade. */
const TRADE_SHELF: Record<string, string> = {
  food: 'retail',
  salon: 'services',
  florist: 'retail',
  apparel: 'retail',
  professional: 'services',
  fitness: 'services',
  'auto-parts': 'services',
  electronics: 'retail',
  wholesale: 'b2b',
};

/** What each trade is ACTUALLY called, in the words a template would use about
 *  itself. Matched against the template's key, name and summary.
 *
 *  These mirror the `tags` on the matching starter in api-rest's
 *  `industry-starters.ts` — deliberately, so the two answers to "what is a food
 *  business" do not drift. They are duplicated rather than imported because
 *  that file ships in another service's image and this list has to be in the
 *  browser bundle; if a third place ever needs them, they belong in
 *  `@piggles/config`. */
const TRADE_WORDS: Record<string, string[]> = {
  food: [
    'food',
    'bakery',
    'baker',
    'cafe',
    'coffee',
    'restaurant',
    'bistro',
    'patisserie',
    'deli',
    'grocer',
    'butcher',
    'kitchen',
    'brew',
    'wine',
    'chocolate',
    'juice',
    'pizzeria',
    'sushi',
    'vegan',
    'catering',
  ],
  salon: ['salon', 'spa', 'beauty', 'barber', 'hair', 'nail', 'lash', 'brow', 'skincare'],
  florist: [
    'florist',
    'flower',
    'floral',
    'bloom',
    'botanic',
    'plant',
    'garden',
    'nursery',
    'bouquet',
    'wedding',
    'workshop',
    'greenhouse',
  ],
  apparel: [
    'apparel',
    'clothing',
    'fashion',
    'boutique',
    'couture',
    'tailor',
    'shoe',
    'denim',
    'knit',
    'streetwear',
    'athletic',
  ],
  professional: [
    'accounting',
    'legal',
    'law',
    'consult',
    'advisory',
    'agency',
    'studio',
    'architect',
    'insurance',
    'financial',
    'therapy',
    'clinic',
  ],
  fitness: [
    'fitness',
    'gym',
    'yoga',
    'pilates',
    'studio',
    'wellness',
    'training',
    'climbing',
    'martial',
    'dance',
    'chiro',
    'physio',
  ],
  'auto-parts': ['auto', 'car', 'vehicle', 'garage', 'motor', 'tire', 'tyre', 'fleet', 'repair'],
  electronics: ['electronic', 'tech', 'computer', 'audio', 'camera', 'gadget', 'repair', 'device'],
  wholesale: ['b2b', 'wholesale', 'trade', 'supply', 'distributor', 'bulk', 'industrial'],
  generic: [],
};

/** How many looks to show. A wall of 169 is not a choice, it is a search task,
 *  and this screen is meant to take a glance. */
export const LOOK_LIMIT = 6;

/** How well one template answers to one trade. Higher is more relevant.
 *
 *  A word in the KEY or the NAME is worth more than one buried in the summary:
 *  `sparx-restaurant-cafe` is a café by identity, whereas a template whose
 *  summary merely mentions coffee is not. */
function relevance(blueprint: BlueprintChoice, words: string[]): number {
  if (words.length === 0) return 0;
  const identity = `${blueprint.key} ${blueprint.name}`.toLowerCase();
  const summary = (blueprint.summary ?? '').toLowerCase();
  let score = 0;
  for (const word of words) {
    if (identity.includes(word)) score += 3;
    else if (summary.includes(word)) score += 1;
  }
  return score;
}

/**
 * The showcase first, then the templates that best answer to this trade.
 *
 * Order: relevance, then on-shelf before off-shelf, then the catalog's own order
 * so the result is stable rather than reshuffling on every render.
 *
 * With no trade picked yet there is nothing to rank by, so the catalog order
 * stands — the same list anybody sees before they have answered.
 */
export function rankLooks(
  blueprints: BlueprintChoice[],
  trade: string,
  showcaseKey: string
): BlueprintChoice[] {
  const showcase = blueprints.filter((b) => b.key === showcaseKey);
  const rest = blueprints.filter((b) => b.key !== showcaseKey);

  const words = TRADE_WORDS[trade] ?? [];
  const shelf = TRADE_SHELF[trade];

  const ranked = rest
    .map((blueprint, index) => ({
      blueprint,
      index,
      score: relevance(blueprint, words),
      onShelf: shelf ? blueprint.vertical === shelf : false,
    }))
    .sort((a, b) => b.score - a.score || Number(b.onShelf) - Number(a.onShelf) || a.index - b.index)
    .map((entry) => entry.blueprint);

  return [...showcase, ...ranked].slice(0, LOOK_LIMIT);
}

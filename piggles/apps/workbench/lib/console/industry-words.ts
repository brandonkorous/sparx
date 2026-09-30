// What Piggles tells you a line of work will set up for you.
//
// The starter list comes down from the API, and its descriptions are written for
// somebody who already knows the platform:
//
//   "A clothing store: size charts, an apparel catalog, US sales tax, tiered
//    shipping, keystone markup, a VIP segment, and a newsletter + sale campaign."
//
// Seven nouns, and four of them are words piggles/CLAUDE.md RULE #3 names as
// terms a person must never be made to learn: catalog, segment, markup, and a
// `+` doing the work of "and". The heading above these cards promises "a head
// start built for it"; the cards then list the parts by their internal names, so
// the one screen that asks a business what it DOES answers in the language of
// the thing being set up rather than the thing being got.
//
// Unlike the other brand vocabularies here, this is not a word swap — the whole
// sentence is different, because what a shop owner wants to know is what she
// will HAVE afterwards. So it is keyed by the starter's slug and replaces the
// sentence outright, the same way `copy.ts` replaces a whole line of copy.
//
// A slug with no entry keeps the API's sentence, which is the honest statement
// that a starter shipped after this file was written. The guard beside it holds
// the other half: every key here has to be a starter the API really sends.

const INDUSTRY_DESCRIPTIONS: Readonly<Record<string, string>> = {
  apparel:
    'A clothing shop: sizes for people to pick from, a set of clothing categories, US sales tax, postage that goes up with the order, prices at double what you paid, a group for your best customers, and two emails ready to send.',
  food: 'A food or grocery shop: a set of food categories, a place to publish recipes, US sales tax, postage, prices at 40% over what you paid, and a monthly newsletter.',
  electronics:
    'A gadget shop: a set of categories, a way to say which device each part fits, a page of common questions, tax, postage, and a New arrivals group of products.',
  'auto-parts':
    'A parts shop: people look up what fits their vehicle by year, make and model, or by tire and wheel size. Quotes that turn into invoices, a page of common questions, tax, postage, and prices at double what you paid.',
  salon:
    'A salon or spa: cuts, color and manicures people can book, with a rule for late cancellations. A group for your best customers, a place for what people say about you, payments you record yourself, and an offer email.',
  florist:
    'A flower shop: a set of bouquet and plant categories, workshops sold by the place with a 48 hour cancellation rule, wedding chats that turn into quotes, US sales tax, postage that goes up with the order, and a seasonal newsletter.',
  fitness:
    'A studio or gym: group classes and one-to-one sessions with a set number of places and a cancellation rule. A group of the people who open your emails, payments you record yourself, and a newsletter.',
  professional:
    'A consultancy or agency: a way for people to book a chat, quotes and repeating invoices with your own kinds of line, the steps a sale moves through, a page of common questions, and a newsletter.',
  wholesale:
    'A wholesale business: price levels for trade customers, orders that wait for your say-so, the steps a sale moves through, deposits and stage payments, free postage over an amount you set, and settings suited to customers who pay later.',
};

/**
 * This brand's sentence for a line of work, or the platform's when there is
 * nothing different to say.
 */
export function industryDescription(slug: string, fallback: string): string {
  return INDUSTRY_DESCRIPTIONS[slug] ?? fallback;
}

/** Every slug this brand rewrites. Exported for the guard beside it. */
export const REWRITTEN_INDUSTRIES: readonly string[] = Object.keys(INDUSTRY_DESCRIPTIONS);

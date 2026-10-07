// What each "What this site shows" switch actually takes off a site.
//
// The card listed one switch per module under the app's name, and three
// modules live in the Sell app, so a journal saw Sell, Sell and Sell with no
// way to tell which was the shop (Piggles persona issue 944). Each switch now
// says what it covers, and only what it covers: four of them change nothing a
// visitor sees, only what an AI assistant connected to the site can look up,
// and saying "hides the newsletter" for one of those would be a promise the
// site does not keep.

const SEEN_BY_VISITORS: Record<string, string> = {
  commerce: 'The shop: products, basket, checkout and order history.',
  cms: 'Articles.',
  crm: 'Requests, estimates and documents to sign.',
  b2b: 'Wholesale accounts.',
  scheduling: 'Booking pages and the list of what can be booked.',
};

const ASSISTANT_ONLY: Record<string, string> = {
  email: 'messages',
  dropship: 'products a supplier ships for you',
  inventory: 'stock levels',
  ai: 'its own tools',
};

export function scopeLine(slug: string): string {
  const seen = SEEN_BY_VISITORS[slug];
  if (seen) return seen;
  const what = ASSISTANT_ONLY[slug];
  if (what) {
    return `Visitors see no difference. It only changes whether an AI assistant connected to this site can use ${what}.`;
  }
  return '';
}

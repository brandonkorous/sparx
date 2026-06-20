// Mosaic home · 07 "Trusted by teams that ship" — a white band: a large cream
// testimonial card with a story link, a 3-up quote row, and a 4-up bordered stat grid.
// Tracks docs/mockups/examples/notion.html.

import { band, displayHeading, quoteCard, statCell } from '../../sections';
import { el, type BuilderNode } from '../../_kit';

export function trusted(): BuilderNode {
  return band({
    name: 'Trusted',
    children: [
      displayHeading('Trusted by teams that ship.'),
      // Feature testimonial.
      el('div', 'w-full rounded-2xl bg-base-200 p-8 @2xl:p-10', {
        children: [
          el('p', 'max-w-2xl font-serif text-2xl italic text-[#191918] @2xl:text-3xl', {
            text: '“There’s power in a single platform where you can do all your work. Mosaic is that single place.”',
          }),
          el('a', 'mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary', { text: 'Read the full story →', attrs: { href: '/customers' } }),
        ],
      }),
      // Three short quotes.
      el('div', 'grid w-full gap-4 @2xl:grid-cols-3', {
        children: [
          quoteCard('“Streamlined workflows that cut our project timelines by 3x.”'),
          quoteCard('“Agents built in three minutes — hours of manual work, gone.”'),
          quoteCard('“One tool solved problems we used to spread across five.”'),
        ],
      }),
      // Stat grid.
      el('div', 'grid w-full grid-cols-2 gap-4 @2xl:grid-cols-4', {
        children: [
          statCell('#1', 'Knowledge base, 3 yrs running'),
          statCell('#1', 'AI enterprise search'),
          statCell('62%', 'of the Fortune 100'),
          statCell('50%+', 'of YC companies'),
        ],
      }),
    ],
  });
}

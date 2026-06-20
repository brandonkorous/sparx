// Mosaic home · 08 "Try for free" — a cream band: a primary "Get started" card
// (monogram + two buttons) beside a stack of two product cards (Mail, Calendar) with
// download links. Tracks docs/mockups/examples/notion.html.

import { btn } from '../../media';
import { band, displayHeading } from '../../sections';
import { atom, el, type BuilderNode } from '../../_kit';

const productCard = (title: string, desc: string): BuilderNode =>
  el('article', 'flex items-center justify-between gap-6 rounded-2xl bg-base-100 p-7 ring-1 ring-black/5', {
    children: [
      el('div', 'flex flex-col', {
        children: [
          atom('Heading', 'text-xl font-semibold text-[#191918]', { level: 'h3', text: title }),
          el('p', 'mt-1 text-sm text-base-content/60', { text: desc }),
          el('a', 'mt-3 inline-flex text-sm font-medium text-primary', { text: 'Download →', attrs: { href: '#' } }),
        ],
      }),
      el('div', 'hidden h-20 w-28 shrink-0 rounded-lg bg-base-200 ring-1 ring-base-300 @sm:block', {}),
    ],
  });

export function tryFree(): BuilderNode {
  return band({
    name: 'Try for free',
    surface: 'subtle',
    children: [
      displayHeading('Try for free.'),
      el('div', 'grid w-full gap-4 @4xl:grid-cols-2', {
        children: [
          // Primary get-started card.
          el('article', 'flex flex-col rounded-2xl bg-base-100 p-8 ring-1 ring-black/5', {
            children: [
              el('span', 'inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#191918] text-lg font-bold text-white', { text: 'M' }),
              atom('Heading', 'mt-5 text-2xl font-semibold text-[#191918]', { level: 'h3', text: 'Get started on Mosaic' }),
              el('p', 'mt-1 text-base-content/60', { text: 'Your AI workspace with built-in agents.' }),
              el('div', 'mt-5 flex flex-wrap gap-2.5', {
                children: [btn('Get Mosaic free', '/request-demo', { variant: 'primary' }), btn('Download for desktop', '#', { variant: 'ghost' })],
              }),
            ],
          }),
          // Companion product cards.
          el('div', 'flex flex-col gap-4', {
            children: [
              productCard('Mosaic Mail', 'The AI inbox that thinks like you.'),
              productCard('Mosaic Calendar', 'Time, scheduling, tasks — all together.'),
            ],
          }),
        ],
      }),
    ],
  });
}

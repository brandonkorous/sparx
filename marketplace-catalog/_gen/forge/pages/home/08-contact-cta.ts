// Forge home · 08 Contact CTA — the big acid band (the design's signature closer). A
// `surface: 'brand'` full-bleed band (so it re-themes to the tenant's primary), centered:
// a small "let's work together" line, a huge slash-led headline in ink, a cream email
// pill + a dark "Book a call" pill, and a location line. Tracks the mockup.

import { arrowRight, btn, slash } from '../../media';
import { band } from '../../sections';
import { el, type BuilderNode } from '../../_kit';

export function contactCta(): BuilderNode {
  return band({
    name: 'Contact CTA',
    surface: 'brand',
    align: 'center',
    gap: 'md',
    children: [
      el('p', 'font-heading text-sm font-medium tracking-wide text-[#15120D]/60', { text: 'Let’s work together' }),
      el('h2', 'font-heading max-w-4xl text-[2.75rem] font-medium leading-[0.98] tracking-tight text-[#15120D] @2xl:text-7xl', {
        children: [slash('mr-2', 'text-[#15120D]'), el('span', '', { text: 'Start something impactful.' })],
      }),
      el('div', 'mt-4 flex flex-wrap items-center justify-center gap-3', {
        children: [
          btn('hello@forge.studio', 'mailto:hello@forge.studio', { variant: 'cream' }),
          btn('Book a call', '/contact', { variant: 'dark', icon: arrowRight() }),
        ],
      }),
      el('p', 'text-sm text-[#15120D]/60', { text: 'Working with teams worldwide' }),
    ],
  });
}

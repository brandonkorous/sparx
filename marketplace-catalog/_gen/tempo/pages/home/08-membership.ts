// Tempo home · 08 The Club — a full-bleed membership band in the club green (the brand
// `secondary` role, so it re-themes on a fork): a motion-mark + "Club" lockup, a big
// uppercase headline + perk line, and two CTAs (join / sign in). Tracks the mockup's
// adiClub membership band.

import { btn, motionMark } from '../../media';
import { el, node, type BuilderNode } from '../../_kit';

export function membership(): BuilderNode {
  return node('Section', {
    name: 'The Club',
    cls: 'bg-secondary',
    box: { padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'row', justify: 'between', alignItems: 'center', gap: 'lg', wrap: true },
    children: [
      el('div', 'max-w-2xl', {
        children: [
          el('div', 'mb-3 flex items-center gap-2', {
            children: [
              motionMark('text-lg', 'text-base-100'),
              el('span', 'font-heading text-lg font-black uppercase tracking-tightest text-base-100', { text: 'The Club' }),
            ],
          }),
          el('h2', 'font-heading text-2xl font-black uppercase leading-[0.95] tracking-tightest text-base-100 @2xl:text-4xl', {
            text: 'Join the Club. Score every time you shop.',
          }),
          el('p', 'mt-3 max-w-xl text-sm text-base-100/85', {
            text: 'Free membership. Earn points on every order, get members-only access to drops and free shipping — plus a birthday surprise.',
          }),
        ],
      }),
      el('div', 'flex shrink-0 flex-col gap-3 @sm:flex-row', {
        children: [btn('Join For Free', '/club', { tone: 'paper' }), btn('Sign In', '/club', { tone: 'outlinePaper' })],
      }),
    ],
  });
}

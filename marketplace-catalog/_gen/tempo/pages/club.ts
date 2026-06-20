// Tempo generator — the Club (membership) page: a hero, the benefit strip, a 3-up of
// membership perks, and a closing join CTA band in the club green. Mirrors the home
// membership band's voice on a dedicated landing.

import { btn, motionMark } from '../media';
import { benefitCell, pageHero, sectionHead } from '../sections';
import { el, node, type BuilderNode } from '../_kit';

const perk = (emoji: string, title: string, body: string): BuilderNode =>
  el('div', 'flex flex-col gap-2 border border-base-300 p-6', {
    children: [
      el('span', 'text-3xl leading-none', { text: emoji }),
      el('h3', 'font-heading text-lg font-black uppercase tracking-tight text-base-content', { text: title }),
      el('p', 'text-sm leading-relaxed text-base-content/65', { text: body }),
    ],
  });

export function clubTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Club', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      pageHero('Membership', 'Join the Club', 'Free to join. Points on every order, members-only drops, free shipping and returns — plus a birthday surprise. The easiest yes in your closet.'),
      // Benefit strip.
      node('Section', {
        name: 'Member benefits',
        cls: 'border-y border-base-300',
        box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'none' },
        children: [
          el('div', 'grid grid-cols-2 gap-px bg-base-300 @3xl:grid-cols-4', {
            children: [
              benefitCell('Free Shipping', 'On every order'),
              benefitCell('Free Returns', 'Within 30 days'),
              benefitCell('Member Pricing', 'Exclusive offers'),
              benefitCell('Early Access', 'Drops before anyone'),
            ],
          }),
        ],
      }),
      // Perks.
      node('Section', {
        box: { name: 'Why join', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
        children: [
          sectionHead('Why Join'),
          el('div', 'grid w-full grid-cols-1 gap-3 @3xl:grid-cols-3', {
            children: [
              perk('🎁', 'Earn on every order', 'Collect points on everything you buy and turn them into rewards you’ll actually use.'),
              perk('⚡', 'Members-only drops', 'Get early access to limited releases and colorways before they sell out.'),
              perk('🚚', 'Shipping on us', 'Free standard shipping and free 30-day returns, no minimums and no fine print.'),
            ],
          }),
        ],
      }),
      // Closing join band (club green).
      node('Section', {
        name: 'Join the Club',
        cls: 'bg-secondary',
        box: { padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'row', justify: 'between', alignItems: 'center', gap: 'lg', wrap: true },
        children: [
          el('div', 'max-w-xl', {
            children: [
              el('div', 'mb-3 flex items-center gap-2', {
                children: [
                  motionMark('text-lg', 'text-base-100'),
                  el('span', 'font-heading text-lg font-black uppercase tracking-tightest text-base-100', { text: 'The Club' }),
                ],
              }),
              el('h2', 'font-heading text-2xl font-black uppercase leading-[0.95] tracking-tightest text-base-100 @2xl:text-4xl', {
                text: 'Ready when you are.',
              }),
              el('p', 'mt-3 text-sm text-base-100/85', { text: 'Sign up in under a minute and we’ll throw in a welcome offer.' }),
            ],
          }),
          el('div', 'flex shrink-0 flex-col gap-3 @sm:flex-row', {
            children: [btn('Join For Free', '/club', { tone: 'paper' }), btn('Sign In', '/club', { tone: 'outlinePaper' })],
          }),
        ],
      }),
    ],
  });
}

// Forge generator — the Careers page (singleton): a page hero, a "why join" perk grid,
// an open-roles list (each row links to the contact page to apply), and the shared
// contact CTA. No dead anchors — roles route to /contact.

import { contactCta } from './home/08-contact-cta';
import { band, pageHero, sectionHeading } from '../sections';
import { el, node, type BuilderNode } from '../_kit';

const PERKS = [
  { title: 'Senior work', desc: 'Real projects for real brands, from day one. No busywork, no decks for the sake of decks.' },
  { title: 'Ownership', desc: 'Own your craft end-to-end and see it ship. We hire people we trust to make the call.' },
  { title: 'Remote-first', desc: 'Work from wherever you do your best thinking, with deliberate time together when it counts.' },
  { title: 'Real balance', desc: 'Ambitious work at a sustainable pace — great results without burning out the team.' },
] as const;

const ROLES = [
  { title: 'Senior Brand Designer', meta: 'Full-time · Remote' },
  { title: 'Web Engineer (React / Next.js)', meta: 'Full-time · Remote' },
  { title: 'Growth Strategist', meta: 'Full-time · Hybrid' },
  { title: 'Motion Designer', meta: 'Contract · Remote' },
] as const;

const perkCard = (title: string, desc: string): BuilderNode =>
  el('div', 'rounded-[1.5rem] border border-white/10 bg-[#221D16] p-8', {
    children: [
      el('h3', 'font-heading text-xl font-semibold text-[#ECE7DD]', { text: title }),
      el('p', 'mt-3 text-sm leading-relaxed text-base-content/70', { text: desc }),
    ],
  });

const roleRow = (title: string, meta: string): BuilderNode =>
  el('a', 'group grid items-center gap-2 py-6 @sm:grid-cols-[1fr_auto] @sm:gap-6', {
    attrs: { href: '/contact' },
    children: [
      el('div', '', {
        children: [
          el('h3', 'font-heading text-xl font-semibold text-[#ECE7DD] transition-colors group-hover:text-[#C6F24E]', { text: title }),
          el('p', 'mt-1 text-sm text-base-content/60', { text: meta }),
        ],
      }),
      el('span', 'text-sm font-medium text-[#C6F24E]', { text: 'Apply →' }),
    ],
  });

export function careersTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Careers', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      pageHero(
        'Careers',
        'Build with us.',
        'We’re a small senior team that ships work we’re proud of. If you care about craft and outcomes in equal measure, we’d love to meet you.'
      ),
      band({
        name: 'Why join',
        children: [
          sectionHeading('Why join Forge', 'max-w-3xl'),
          el('div', 'grid w-full gap-6 @sm:grid-cols-2 @3xl:grid-cols-4', {
            children: PERKS.map((p) => perkCard(p.title, p.desc)),
          }),
        ],
      }),
      band({
        name: 'Open roles',
        children: [
          sectionHeading('Open roles', 'max-w-3xl'),
          el('div', 'w-full divide-y divide-white/10 border-y border-white/10', {
            children: ROLES.map((r) => roleRow(r.title, r.meta)),
          }),
        ],
      }),
      contactCta(),
    ],
  });
}

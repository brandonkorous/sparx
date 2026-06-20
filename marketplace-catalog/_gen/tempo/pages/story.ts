// Tempo generator — the Our Story page: a hero, two alternating editorial split bands
// (copy beside a campaign glyph panel), and a values 3-up. Static editorial copy in the
// brand voice; the tenant rewrites it post-install.

import { GRAD, glyphPanel } from '../media';
import { pageHero, sectionHead } from '../sections';
import { el, node, type BuilderNode } from '../_kit';

const splitBand = (opts: {
  name: string;
  heading: string;
  paragraphs: string[];
  glyph: string;
  gradientCls: string;
  photoFirst?: boolean;
}): BuilderNode => {
  const copy = el('div', 'flex flex-col gap-4', {
    children: [
      el('h2', 'font-heading text-2xl font-black uppercase leading-tight tracking-tightest text-base-content @2xl:text-3xl', { text: opts.heading }),
      ...opts.paragraphs.map((t) => el('p', 'text-base leading-relaxed text-base-content/70', { text: t })),
    ],
  });
  const photo = glyphPanel(opts.glyph, opts.gradientCls, 'h-64 w-full @2xl:h-80');
  return node('Section', {
    box: { name: opts.name, padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'grid', columns: 2, gap: 'xl', alignItems: 'center' },
    children: opts.photoFirst ? [photo, copy] : [copy, photo],
  });
};

const value = (emoji: string, title: string, body: string): BuilderNode =>
  el('div', 'flex flex-col items-center gap-2 text-center', {
    children: [
      el('span', 'text-4xl leading-none', { text: emoji }),
      el('h3', 'font-heading text-lg font-black uppercase tracking-tight text-base-content', { text: title }),
      el('p', 'text-sm leading-relaxed text-base-content/65', { text: body }),
    ],
  });

export function storyTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Our Story', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      pageHero('Our Story', 'Made to move', 'Tempo started with a simple brief: build gear that performs as hard as the people who wear it — and looks right doing it.'),
      splitBand({
        name: 'The brief',
        heading: 'Performance, never an afterthought',
        paragraphs: [
          'Every Tempo product starts on the track, the pitch, or the trail — tested by the athletes who push it hardest, then refined until it earns a place in the line.',
          'We obsess over the details that matter at speed: energy return, lockdown, breathability, and a fit that disappears the moment you start moving.',
        ],
        glyph: '🏃',
        gradientCls: GRAD.sky,
      }),
      splitBand({
        name: 'The loop',
        heading: 'Built to be remade',
        paragraphs: [
          'A shoe that ends its life in a landfill is a design failure. So we build from reclaimed materials and design our product to come back when the miles are done.',
          'It’s early, and we’re not finished — but every pair you send back becomes part of the next one. That’s a future worth running toward.',
        ],
        glyph: '♻️',
        gradientCls: GRAD.pitch,
        photoFirst: true,
      }),
      // Values.
      node('Section', {
        box: { name: 'What we stand for', surface: 'subtle', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
        children: [
          sectionHead('What We Stand For'),
          el('div', 'grid w-full grid-cols-1 gap-6 @3xl:grid-cols-3', {
            children: [
              value('⚡', 'Engineered', 'Tested by athletes, refined for everyone.'),
              value('♻️', 'Responsible', 'Reclaimed materials, designed to loop.'),
              value('🤝', 'For everyone', 'Sport belongs to all of us — men, women, kids.'),
            ],
          }),
        ],
      }),
    ],
  });
}

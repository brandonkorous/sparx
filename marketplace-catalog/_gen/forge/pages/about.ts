// Forge generator — the About page (singleton): a page hero, a "what we believe" grid,
// the stats band + testimonials (reused from the home page), and the shared contact CTA.

import { contactCta } from './home/08-contact-cta';
import { stats } from './home/04-stats';
import { testimonials } from './home/07-testimonials';
import { band, pageHero, sectionHeading } from '../sections';
import { el, node, type BuilderNode } from '../_kit';

const VALUES = [
  { title: 'Strategy first', desc: 'We earn the design by understanding the business behind it. Pretty that doesn’t perform isn’t the work.' },
  { title: 'Senior, hands-on', desc: 'The people in the pitch are the people on your project — no hand-off to a junior bench after you sign.' },
  { title: 'Built to ship', desc: 'We design in the medium it ships in, so what you approve is what you launch: pixel-tight, fast, and on-brand.' },
  { title: 'Partners, not vendors', desc: 'We stay on after launch to measure, iterate, and grow. Your numbers are our scoreboard.' },
] as const;

const valueCard = (title: string, desc: string): BuilderNode =>
  el('div', 'rounded-[1.5rem] border border-white/10 bg-[#221D16] p-8', {
    children: [
      el('h3', 'font-heading text-2xl font-semibold text-[#ECE7DD]', { text: title }),
      el('p', 'mt-3 text-sm leading-relaxed text-base-content/70', { text: desc }),
    ],
  });

export function aboutTree(): BuilderNode {
  return node('Section', {
    box: { name: 'About', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      pageHero(
        'About',
        'A studio engineered for growth.',
        'Since 2014 we’ve helped ambitious teams look and perform like the company they’re becoming. We’re a small senior team that ships like a big one.'
      ),
      band({
        name: 'What we believe',
        children: [
          sectionHeading('What we believe', 'max-w-3xl'),
          el('div', 'grid w-full gap-6 @sm:grid-cols-2', {
            children: VALUES.map((v) => valueCard(v.title, v.desc)),
          }),
        ],
      }),
      stats(),
      testimonials(),
      contactCta(),
    ],
  });
}

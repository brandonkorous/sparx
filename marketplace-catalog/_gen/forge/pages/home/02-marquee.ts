// Forge home · 02 Logo + awards marquee — a recessed band: a "trusted by" line, a
// continuously scrolling row of muted client wordmarks (the `marquee` behavior, docs/98
// Pillar 5 — the live runtime clones the track for a seamless loop, reduced-motion
// aware), and a centered row of award/recognition lines. Tracks the mockup.

import { awardItem } from '../../media';
import { band } from '../../sections';
import { behave, el, part, type BuilderNode } from '../../_kit';

const NAMES = ['Vela', 'Northwind', 'Lumen', 'Contoso', 'Aperture', 'Globex', 'Hooli', 'Umbra'];

/** The scrolling wordmark strip — ONE set of names on a track wearing `animate-marquee`;
 *  the live surface clones the children, so it must not be pre-doubled. */
const marquee = (): BuilderNode =>
  behave(
    el('div', 'w-full overflow-hidden', {
      name: 'Client marquee',
      attrs: { ariaLabel: 'Trusted by' },
      children: [
        part(
          el('div', 'flex w-max items-center gap-16 font-heading text-2xl font-semibold text-base-content/30 animate-marquee', {
            name: 'Track',
            children: NAMES.map((n) => el('span', 'shrink-0 whitespace-nowrap', { text: n })),
          }),
          'track'
        ),
      ],
    }),
    { type: 'marquee', pauseOnHover: true }
  );

const awards = (): BuilderNode =>
  el('div', 'flex flex-wrap items-center justify-center gap-x-10 gap-y-4', {
    children: [
      awardItem('Site of the Day ×7'),
      awardItem('Design Award ×12'),
      awardItem('Top Agency 2025'),
      awardItem('Industry Honoree'),
    ],
  });

export function marqueeBand(): BuilderNode {
  return band({
    name: 'Logos & awards',
    surface: 'subtle',
    align: 'center',
    gap: 'lg',
    children: [
      el('p', 'text-center text-sm tracking-wide text-base-content/60', {
        text: 'Trusted by category leaders & recognized by the industry',
      }),
      marquee(),
      awards(),
    ],
  });
}

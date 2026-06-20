// Tempo home · 02 Find Your Team — a contained band whose heading sits over a MARQUEE
// (docs/98 Pillar 5) of colorway tiles that scrolls continuously and pauses on hover. The
// live runtime clones the track for a seamless loop, so the track ships ONE set of tiles
// (not pre-doubled). Tracks the mockup's horizontal team scroller.

import { GRAD, motionMark } from '../../media';
import { colorwayTile } from '../../sections';
import { behave, el, node, part, type BuilderNode } from '../../_kit';

const TEAMS: Array<[string, string]> = [
  ['Mexico', GRAD.pitch],
  ['Spain', GRAD.ruby],
  ['Argentina', GRAD.sky],
  ['Colombia', GRAD.sunset],
  ['Germany', GRAD.ink],
  ['Brazil', GRAD.pitch],
  ['France', GRAD.blueDeep],
  ['Italy', GRAD.teal],
];

const marquee = (): BuilderNode =>
  behave(
    el('div', 'w-full overflow-hidden', {
      name: 'Team marquee',
      attrs: { ariaLabel: 'Shop by team' },
      children: [
        part(
          el('div', 'flex w-max items-stretch gap-3 animate-marquee', {
            name: 'Track',
            children: TEAMS.map(([name, grad]) => colorwayTile(name, grad)),
          }),
          'track'
        ),
      ],
    }),
    { type: 'marquee', pauseOnHover: true }
  );

export function findYourTeam(): BuilderNode {
  return node('Section', {
    box: { name: 'Find Your Team', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
    children: [
      el('h2', 'flex items-center gap-2 font-heading text-xl font-black uppercase tracking-tightest text-base-content @2xl:text-2xl', {
        children: [motionMark('text-xl'), el('span', '', { text: 'Find Your Team' })],
      }),
      marquee(),
    ],
  });
}

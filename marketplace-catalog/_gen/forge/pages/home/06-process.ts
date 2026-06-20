// Forge home · 06 Process — a recessed band: "How we engineer growth" over a 4-up grid
// of phase cards (Discover · Define · Design · Deploy). Tracks the mockup.

import { PHASES } from '../../data';
import { band, phaseCard, sectionHeading } from '../../sections';
import { el, type BuilderNode } from '../../_kit';

export function process(): BuilderNode {
  return band({
    name: 'Process',
    surface: 'subtle',
    gap: 'lg',
    children: [
      sectionHeading('How we engineer growth', 'max-w-3xl'),
      el('div', 'grid w-full gap-6 @sm:grid-cols-2 @3xl:grid-cols-4', {
        children: PHASES.map((p) => phaseCard(p.phase, p.title, p.desc)),
      }),
    ],
  });
}

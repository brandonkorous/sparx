// Forge home · 04 Stats — a recessed band with a 4-up grid of big display figures over
// small captions (projects shipped, awards, revenue influenced, years). Tracks the mockup.

import { statCell } from '../../media';
import { band } from '../../sections';
import { el, type BuilderNode } from '../../_kit';

export function stats(): BuilderNode {
  return band({
    name: 'Stats',
    surface: 'subtle',
    gap: 'lg',
    children: [
      el('div', 'grid w-full gap-12 @sm:grid-cols-2 @3xl:grid-cols-4', {
        children: [
          statCell('240', 'Projects shipped worldwide', {
            valueCls: 'text-[#C6F24E]',
            suffix: '+',
            suffixCls: 'text-[#ECE7DD]',
          }),
          statCell('38', 'Industry awards & honors'),
          statCell('$2.4', 'Client revenue influenced', { suffix: 'B', suffixCls: 'text-[#C6F24E]' }),
          statCell('11', 'Years designing for growth', { suffix: 'yrs', suffixCls: 'text-base-content/50' }),
        ],
      }),
    ],
  });
}

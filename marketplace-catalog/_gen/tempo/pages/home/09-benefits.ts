// Tempo home · 09 Benefits — a full-bleed 4-up benefit strip. The `gap-px` over a
// base-300 fill draws the hairlines between the white cells (the mockup's bordered
// 4-up). Tracks the mockup's benefit strip.

import { benefitCell } from '../../sections';
import { el, node, type BuilderNode } from '../../_kit';

export function benefits(): BuilderNode {
  return node('Section', {
    name: 'Benefits',
    cls: 'border-y border-base-300',
    box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      el('div', 'grid grid-cols-2 gap-px bg-base-300 @3xl:grid-cols-4', {
        children: [
          benefitCell('Free Shipping', 'For Club members'),
          benefitCell('Free Returns', 'Within 30 days'),
          benefitCell('Member Pricing', 'Exclusive offers'),
          benefitCell('Order Tracking', 'Every step of the way'),
        ],
      }),
    ],
  });
}

// Mosaic home · 03 Logo wall — a hairline-topped band with a scrolling row of muted
// customer wordmarks. The track carries the `marquee` behavior (docs/98 Pillar 5) so
// the storefront runtime animates it (reduced-motion aware); the list is duplicated so
// the loop reads seamlessly, and a static fallback still looks like a logo strip.
// Tracks docs/mockups/examples/notion.html.

import { behave, el, node, part, type BuilderNode } from '../../_kit';

const NAMES = ['Vela', 'Northwind', 'Lumen', 'Contoso', 'Aperture', 'Initech', 'Globex', 'Hooli', 'Umbra', 'Stark Labs'];

const wordmark = (name: string): BuilderNode =>
  el('span', 'shrink-0 whitespace-nowrap', { text: name });

export function logos(): BuilderNode {
  // Two copies of the list so the marquee wraps without a visible seam.
  const items = [...NAMES, ...NAMES].map(wordmark);
  const track = part(
    el('div', 'flex w-max items-center gap-14 px-7 text-2xl font-semibold text-base-content/25', { children: items }),
    'track'
  );
  const viewport = behave(el('div', 'w-full overflow-hidden', { children: [track] }), { type: 'marquee', speed: 34 });
  return node('Section', {
    name: 'Logo wall',
    cls: 'border-t border-base-300',
    box: { name: 'Logo wall', padding: 'lg', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [viewport],
  });
}

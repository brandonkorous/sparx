// Farm Fresh Bowls generator — the Locations page: intro + a text/map block per store.

import { node, type BuilderNode } from '../_kit';

export function locationsTree(): BuilderNode {
  const locationBlock = (name: string, address: string, hours: string): BuilderNode =>
    node('Section', {
      box: { name, padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
      layout: { direction: 'grid', columns: 2, gap: 'lg', alignItems: 'center' },
      children: [
        node('Stack', {
          box: { padding: 'none' },
          layout: { direction: 'stack', gap: 'sm', alignItems: 'start', justify: 'center' },
          children: [
            node('Heading', { props: { level: 'h2', text: name } }),
            node('Text', { props: { variant: 'body', text: address } }),
            node('Text', { props: { variant: 'meta', text: hours } }),
            node('Button', { props: { label: 'Order Pickup', style: 'primary', href: '/menu' } }),
          ],
        }),
        node('Map', { props: { query: address } }),
      ],
    });
  return node('Section', {
    box: { name: 'Locations', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: { name: 'Locations intro', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained', align: 'center' },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center' },
        children: [
          node('Heading', { box: { align: 'center' }, props: { level: 'h1', text: 'Find us' } }),
          node('Text', {
            box: { align: 'center' },
            props: { variant: 'body', text: 'Two neighborhoods, one fresh standard. Pickup and free local delivery at both.' },
          }),
        ],
      }),
      locationBlock('Riverside Market', '214 Orchard Lane, Riverside, CA 92501', 'Mon–Fri · 7am–7pm · Sat–Sun · 8am–5pm'),
      locationBlock('Downtown Commons', '88 Maple Street, Suite B, Riverside, CA 92507', 'Mon–Fri · 6:30am–8pm · Sat–Sun · 8am–6pm'),
    ],
  });
}

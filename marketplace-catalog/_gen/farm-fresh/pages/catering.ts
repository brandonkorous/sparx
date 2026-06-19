// Farm Fresh generator — the Catering page: hero · three option cards · CTA band.

import { node, type BuilderNode } from '../_kit';
import { valueCard } from '../sections';

export function cateringTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Catering', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: {
          name: 'Catering hero',
          surface: 'brand',
          height: 'md',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'center' },
        children: [
          node('Heading', { box: { align: 'center' }, props: { level: 'h1', size: 'display', text: 'Catering & events' } }),
          node('Text', {
            box: { align: 'center' },
            props: { variant: 'body', text: 'Bowl bars, smoothie stations and grain platters — built fresh, delivered on time.' },
          }),
        ],
      }),
      node('Section', {
        box: { name: 'Catering options', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'grid', columns: 3, gap: 'lg' },
        children: [
          valueCard('🥣', 'Bowl bars', 'Build-your-own açaí & smoothie stations for any crowd.'),
          valueCard('🥗', 'Grain platters', 'Seasonal salad and grain platters, portioned and labeled.'),
          valueCard('🚲', 'On-time delivery', 'Set up and delivered fresh, in compostable packaging.'),
        ],
      }),
      node('Section', {
        box: { name: 'Catering CTA', surface: 'brand', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained', align: 'center' },
        layout: { direction: 'stack', gap: 'md', alignItems: 'center', justify: 'center' },
        children: [
          node('Heading', { box: { align: 'center' }, props: { level: 'h2', text: 'Plan your event' } }),
          node('Text', {
            box: { align: 'center' },
            props: { variant: 'body', text: 'Tell us the date, the headcount, and the vibe — we’ll handle the fresh part.' },
          }),
          node('Signup', { props: { cta: 'Request a quote' } }),
        ],
      }),
    ],
  });
}

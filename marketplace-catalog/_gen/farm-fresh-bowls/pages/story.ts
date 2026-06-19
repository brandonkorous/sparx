// Farm Fresh Bowls generator — the Our Story page: hero · two editorial split bands ·
// values strip.

import { node, type BuilderNode } from '../_kit';
import { splitBand, valueCard } from '../sections';

export function storyTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Story', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: {
          name: 'Story hero',
          surface: 'brand',
          height: 'md',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'center' },
        children: [
          node('Heading', { box: { align: 'center' }, props: { level: 'h1', size: 'display', text: 'Our Farm Fresh story' } }),
          node('Text', {
            box: { align: 'center' },
            props: { variant: 'body', text: 'Healthy bowls from healthy people, to make people healthy and happy.' },
          }),
        ],
      }),
      splitBand({
        name: 'We really do care',
        surface: 'subtle',
        heading: 'We really do care',
        paragraphs: [
          'It started in 2018 with one counter, a blender, and a standing order from three farms we could drive to.',
          'We care about your health — and we believe feeling good is where everything starts.',
        ],
        seed: 'story-care',
      }),
      splitBand({
        name: 'Food that loves you back',
        heading: 'Food that loves you back',
        paragraphs: [
          'Every bowl is built to order from local, wholesome ingredients — balanced for the nutrients you need.',
          'Nothing artificial, nothing frozen, and never a shortcut on quality.',
        ],
        seed: 'story-food',
        photoFirst: true,
      }),
      node('Section', {
        box: { name: 'Values', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'grid', columns: 4, gap: 'lg' },
        children: [
          valueCard('🌾', 'Locally Sourced', 'From farms within 60 miles'),
          valueCard('🚫', 'No Preservatives', 'Nothing artificial, ever'),
          valueCard('⚖️', 'Balanced Macros', 'Portioned by nutritionists'),
          valueCard('♻️', 'Eco Packaging', '100% compostable bowls'),
        ],
      }),
    ],
  });
}

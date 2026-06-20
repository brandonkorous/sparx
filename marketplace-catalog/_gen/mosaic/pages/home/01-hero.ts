// Mosaic home · 01 Hero — a centered band: an overlapping avatar/agent cluster, a
// display headline carrying an inline lime "Ship" pill, a muted subhead, and two CTAs.
// The headline is a raw <h1> so it can nest the inline pill (the Heading atom renders
// only flat text). Tracks docs/mockups/examples/notion.html.

import { avatar, btn } from '../../media';
import { el, node, type BuilderNode } from '../../_kit';

/** The headline with its inline lime "Ship" pill (green dot + green word). */
const headline = (): BuilderNode =>
  el(
    'h1',
    'mx-auto max-w-3xl text-center text-[2.75rem] font-bold leading-[1.04] tracking-tight text-[#191918] @2xl:text-6xl @4xl:text-[4.25rem]',
    {
      children: [
        el('span', '', { text: 'Where teams and agents ' }),
        el('span', 'mx-1 inline-flex items-center gap-2 rounded-2xl bg-[#C8F2C2] px-4 py-0.5 align-middle', {
          children: [
            el('span', 'h-2.5 w-2.5 rounded-full bg-[#2E9E4F]', {}),
            el('span', 'text-[#1E7A38]', { text: 'Ship' }),
          ],
        }),
        el('span', '', { text: ' together.' }),
      ],
    }
  );

export function hero(): BuilderNode {
  return node('Section', {
    box: { name: 'Hero', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained', align: 'center' },
    layout: { direction: 'stack', gap: 'none', alignItems: 'center', justify: 'center' },
    children: [
      // Avatar + agent cluster — six ringed discs, overlapping.
      el('div', 'mb-7 flex items-center justify-center -space-x-2', {
        children: [
          avatar('🧑‍💻', 'bg-[#DDEBF1]'),
          avatar('👩‍🎨', 'bg-[#FBECDD]'),
          avatar('✨', 'bg-[#211F33] text-white', 'text-lg'),
          avatar('🧑‍🔬', 'bg-[#DDEDEA]'),
          avatar('🤖', 'bg-[#5C97E8] text-white', 'text-lg'),
          avatar('🧑‍🚀', 'bg-[#E9E5F8]'),
        ],
      }),
      headline(),
      el('p', 'mx-auto mt-6 max-w-xl text-lg text-base-content/60 @2xl:text-xl', {
        text: 'Capture context, find answers, and automate tasks with AI built for your team.',
      }),
      el('div', 'mt-8 flex flex-col items-center justify-center gap-3 @sm:flex-row', {
        children: [
          btn('Get Mosaic free', '/request-demo', { variant: 'primary', cls: 'w-full @sm:w-auto' }),
          btn('Request a demo', '/request-demo', { variant: 'ghost', cls: 'w-full @sm:w-auto' }),
        ],
      }),
    ],
  });
}

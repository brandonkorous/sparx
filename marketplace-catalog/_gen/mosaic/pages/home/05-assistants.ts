// Mosaic home · 05 "Ask your on-demand assistants" — a white band with the assistants
// bento: one wide split card (copy + amber running-agent panel), then two cards (coral
// search panel, blue meeting-notes panel). Each copy half carries a circular arrow
// pill. Tracks docs/mockups/examples/notion.html.

import { skel } from '../../media';
import { band, bentoCopy, displayHeading } from '../../sections';
import { el, type BuilderNode } from '../../_kit';

/** The amber "Agent · running" panel — a floating chip with two loading bars. */
const agentPanel = (): BuilderNode =>
  el('div', 'relative min-h-[200px] bg-[#FFC93C] p-7', {
    children: [
      el('div', 'absolute inset-x-7 top-7 rounded-xl bg-white/80 p-4 text-sm shadow-lg', {
        children: [
          el('p', 'font-medium text-[#191918]', { text: '⚡ Agent · running' }),
          skel('w-3/4', 'bg-black/10', 'mt-2'),
          skel('w-1/2', 'bg-black/10', 'mt-2'),
        ],
      }),
    ],
  });

/** The coral universal-search panel — a search field over two result rows. */
const searchPanel = (): BuilderNode =>
  el('div', 'min-h-[210px] bg-[#EF6F5C] p-7', {
    children: [
      el('div', 'flex items-center gap-2 rounded-xl bg-base-100 px-4 py-3 text-sm shadow-lg', {
        children: [el('span', '', { text: '🔍' }), el('span', 'text-base-content/60', { text: 'Search docs, chats, drive…' })],
      }),
      el('div', 'mt-3 flex flex-col gap-2', {
        children: [
          el('div', 'rounded-lg bg-white/80 px-3 py-2 text-xs text-[#191918]', { text: '📄 Q2 launch brief' }),
          el('div', 'rounded-lg bg-white/80 px-3 py-2 text-xs text-[#191918]', { text: '💬 #product-launch thread' }),
        ],
      }),
    ],
  });

/** The blue meeting-notes panel — a recap card with bullet lines. */
const notesPanel = (): BuilderNode =>
  el('div', 'min-h-[210px] bg-[#5C97E8] p-7', {
    children: [
      el('div', 'rounded-xl bg-base-100 p-4 text-sm shadow-lg', {
        children: [
          el('p', 'font-medium text-[#191918]', { text: '🎙️ Standup — June 15' }),
          el('p', 'mt-2 text-xs text-base-content/60', { text: '• Shipped universal search' }),
          el('p', 'text-xs text-base-content/60', { text: '• Action: Sam to finalize deck' }),
          el('p', 'text-xs text-base-content/60', { text: '• Risk: SSO timeline at risk' }),
        ],
      }),
    ],
  });

const bentoCard = (panel: BuilderNode, label: string, heading: string): BuilderNode =>
  el('article', 'overflow-hidden rounded-2xl ring-1 ring-black/5', { children: [bentoCopy(label, heading), panel] });

export function assistants(): BuilderNode {
  return band({
    name: 'On-demand assistants',
    children: [
      displayHeading('Ask your on-demand assistants.'),
      el('div', 'grid w-full gap-4', {
        children: [
          // Wide split — copy beside the amber agent panel.
          el('article', 'grid overflow-hidden rounded-2xl ring-1 ring-black/5 @2xl:grid-cols-2', {
            children: [bentoCopy('Mosaic Agent', 'You assign the tasks. Mosaic Agent does the work.'), agentPanel()],
          }),
          // Two solid cards.
          el('div', 'grid gap-4 @2xl:grid-cols-2', {
            children: [
              bentoCard(searchPanel(), 'Enterprise Search', 'One search for everything.'),
              bentoCard(notesPanel(), 'AI Meeting Notes', 'Perfect notes, every time.'),
            ],
          }),
        ],
      }),
    ],
  });
}

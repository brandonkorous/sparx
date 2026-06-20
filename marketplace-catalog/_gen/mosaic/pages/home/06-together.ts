// Mosaic home · 06 "Bring all your work together" — a cream band with the workspace
// bento: two cards (teal Docs skeleton, blue Knowledge-Base tile grid) over a wide
// brown Projects card (a 3-column kanban). Closes with a centered serif pull-quote.
// Tracks docs/mockups/examples/notion.html.

import { skel } from '../../media';
import { band, bentoCopy, displayHeading } from '../../sections';
import { el, type BuilderNode } from '../../_kit';

/** The teal Docs panel — a document card sketched with skeleton lines. */
const docsPanel = (): BuilderNode =>
  el('div', 'min-h-[200px] bg-[#1F9E8F] p-7', {
    children: [
      el('div', 'rounded-xl bg-base-100 p-5 shadow-lg', {
        children: [
          skel('w-1/2', 'bg-black/10'),
          skel('w-full', 'bg-black/10', 'mt-3'),
          skel('w-5/6', 'bg-black/10', 'mt-2'),
          skel('w-2/3', 'bg-black/10', 'mt-2'),
        ],
      }),
    ],
  });

const kbTile = (text: string): BuilderNode =>
  el('div', 'rounded-lg bg-white/85 p-3 text-xs text-[#191918]', { text });

/** The blue Knowledge-Base panel — a 2×2 grid of source tiles. */
const kbPanel = (): BuilderNode =>
  el('div', 'min-h-[200px] bg-[#5C97E8] p-7', {
    children: [
      el('div', 'grid grid-cols-2 gap-3', {
        children: [kbTile('📕 Engineering Wiki'), kbTile('🎨 Design System'), kbTile('🧾 Policies'), kbTile('🚀 Onboarding')],
      }),
    ],
  });

const kanbanCol = (items: string[]): BuilderNode =>
  el('div', 'flex flex-col gap-2', {
    children: [skel('w-12', 'bg-white/40'), ...items.map((t) => el('div', 'rounded-lg bg-white/85 p-2 text-xs text-[#191918]', { text: t }))],
  });

/** The brown Projects panel — a 3-column kanban of cards. */
const projectsPanel = (): BuilderNode =>
  el('div', 'min-h-[200px] bg-[#A9744F] p-7', {
    children: [el('div', 'grid h-full grid-cols-3 gap-3', { children: [kanbanCol(['Spec', 'Design']), kanbanCol(['Build']), kanbanCol(['Launch'])] })],
  });

const card = (panel: BuilderNode, label: string, heading: string): BuilderNode =>
  el('article', 'overflow-hidden rounded-2xl bg-base-100 ring-1 ring-black/5', { children: [bentoCopy(label, heading), panel] });

export function together(): BuilderNode {
  return band({
    name: 'Work together',
    surface: 'subtle',
    children: [
      displayHeading('Bring all your work together.'),
      el('div', 'grid w-full gap-4', {
        children: [
          el('div', 'grid gap-4 @2xl:grid-cols-2', {
            children: [card(docsPanel(), 'Docs', 'Simple and powerful.'), card(kbPanel(), 'Knowledge Base', 'One source of truth for teams and agents.')],
          }),
          el('article', 'grid overflow-hidden rounded-2xl bg-base-100 ring-1 ring-black/5 @2xl:grid-cols-[1fr_1.4fr]', {
            children: [bentoCopy('Projects', 'Less tracking. More progress.'), projectsPanel()],
          }),
        ],
      }),
      el('p', 'mt-2 w-full text-center font-serif text-2xl italic text-[#191918] @2xl:text-3xl', { text: '“Your AI everything app.”' }),
    ],
  });
}

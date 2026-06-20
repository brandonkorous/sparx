// Mosaic home · 04 "Keep work moving 24/7" — a cream band with the Custom Agents split
// panel (copy + a play pill beside a stack of agent rows) over a 5-up capability grid
// (four light cards + one dark navy card). Tracks docs/mockups/examples/notion.html.

import { iconTile, playPill } from '../../media';
import { band, cardLabel, displayHeading } from '../../sections';
import { atom, el, type BuilderNode } from '../../_kit';

/** One agent row — a colored icon tile beside a title (+ optional supporting line). */
const agentRow = (emoji: string, bgHex: string, title: string, body?: string): BuilderNode =>
  el('div', 'flex items-center gap-3 rounded-xl bg-base-200 p-3 text-sm', {
    children: [
      iconTile(emoji, bgHex),
      body
        ? el('div', 'flex flex-col', {
            children: [
              el('p', 'font-medium text-[#191918]', { text: title }),
              el('p', 'text-xs text-base-content/60', { text: body }),
            ],
          })
        : el('p', 'font-medium text-[#191918]', { text: title }),
    ],
  });

/** One capability card — emoji over a one-line action. `dark` flips it to the navy
 *  "create your own" tile. */
const capCard = (emoji: string, text: string, dark = false): BuilderNode =>
  el('div', `flex flex-col gap-2 rounded-xl p-4 text-sm ${dark ? 'bg-[#211F33] text-white' : 'bg-base-100 ring-1 ring-base-300'}`, {
    children: [
      el('span', 'text-lg', { text: emoji }),
      el('p', `font-medium ${dark ? '' : 'text-[#191918]'}`, { text: `${text} →` }),
    ],
  });

export function agents(): BuilderNode {
  return band({
    name: 'Keep work moving',
    surface: 'subtle',
    children: [
      displayHeading('Keep work moving 24/7.'),
      // Custom Agents split panel.
      el('div', 'w-full overflow-hidden rounded-2xl bg-base-100 ring-1 ring-black/5', {
        children: [
          el('div', 'grid gap-6 p-7 @2xl:grid-cols-2 @2xl:p-9', {
            children: [
              el('div', 'flex flex-col', {
                children: [
                  cardLabel('Custom Agents'),
                  atom('Heading', 'mt-1 text-2xl font-semibold text-[#191918]', { level: 'h3', text: 'Automate repetitive work for your team.' }),
                  playPill('mt-5'),
                ],
              }),
              el('div', 'flex flex-col gap-2.5', {
                children: [
                  agentRow('⚡', '#EF6F5C', 'Q&A agents', 'Answer questions instantly using knowledge you already have.'),
                  agentRow('🧭', '#5C97E8', 'Task routing agents'),
                  agentRow('📊', '#1F9E8F', 'Reporting agents'),
                  agentRow('＋', '#A9744F', 'Create your own'),
                ],
              }),
            ],
          }),
        ],
      }),
      cardLabel('See what Custom Agents can do'),
      // Capability grid — 2 → 3 → 5 columns.
      el('div', 'grid w-full grid-cols-2 gap-3 @2xl:grid-cols-3 @4xl:grid-cols-5', {
        children: [
          capCard('💬', 'Triage product feedback'),
          capCard('🎫', 'Resolve support tickets in chat'),
          capCard('🛡️', 'Respond to security alerts faster'),
          capCard('📈', 'Automate weekly reporting'),
          capCard('✨', 'Create your own Custom Agent', true),
        ],
      }),
    ],
  });
}

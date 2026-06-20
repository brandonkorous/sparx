// Mosaic home · 02 Workspace preview — the product shot, built as REAL elements (not
// an image): a browser-chrome card (traffic-light dots + URL pill) wrapping a sidebar
// (workspace nav) and a main pane with tabs and a faux database table. Floating coral/
// amber accent discs pin over the corners. Tracks docs/mockups/examples/notion.html.

import { ownerDot, statusPill } from '../../media';
import { el, node, type BuilderNode } from '../../_kit';

// ── Sidebar atoms ─────────────────────────────────────────────────────────────────
const navItem = (glyph: string, label: string, active = false): BuilderNode =>
  el('div', `flex items-center gap-2 rounded-md px-2 py-1.5 ${active ? 'bg-base-200 font-medium text-[#191918]' : 'text-base-content/60'}`, {
    children: [el('span', '', { text: glyph }), el('span', '', { text: label })],
  });

const sidebar = (): BuilderNode =>
  el('aside', 'hidden w-56 shrink-0 flex-col gap-0.5 border-r border-base-300 bg-[#FBFBFA] p-3 text-sm @2xl:flex', {
    children: [
      el('div', 'flex items-center gap-2 rounded-md px-2 py-1.5 font-medium text-[#191918]', {
        children: [
          el('span', 'inline-flex h-5 w-5 items-center justify-center rounded bg-[#191918] text-[10px] font-bold text-white', { text: 'A' }),
          el('span', '', { text: 'Acme HQ' }),
        ],
      }),
      navItem('🔍', 'Search'),
      navItem('✨', 'Mosaic AI'),
      navItem('🏠', 'Home'),
      el('p', 'mt-3 px-2 text-[11px] font-semibold uppercase tracking-wide text-base-content/40', { text: 'Workspace' }),
      navItem('📋', 'Company tasks', true),
      navItem('🗺️', 'Roadmap'),
      navItem('📚', 'Engineering Wiki'),
      navItem('🎯', 'OKRs'),
      navItem('💬', 'Meeting Notes'),
    ],
  });

// ── Main pane atoms ───────────────────────────────────────────────────────────────
const tab = (label: string, active = false): BuilderNode =>
  active
    ? el('span', '-mb-px border-b-2 border-[#191918] pb-2 font-medium text-[#191918]', { text: label })
    : el('span', 'pb-2 text-base-content/60', { text: label });

const tableRow = (task: string, status: BuilderNode, owner: BuilderNode): BuilderNode =>
  el('div', 'grid grid-cols-[1.6fr_0.9fr_1fr] items-center border-t border-base-300 px-3 py-2.5', {
    children: [el('span', '', { text: task }), el('span', '', { children: [status] }), owner],
  });

const mainPane = (): BuilderNode =>
  el('div', 'flex-1 overflow-hidden px-5 py-6 @sm:px-8', {
    children: [
      el('div', 'flex items-center gap-2', {
        children: [el('span', 'text-2xl', { text: '📋' }), el('span', 'text-xl font-bold text-[#191918]', { text: 'Company tasks' })],
      }),
      el('div', 'mt-4 flex gap-4 border-b border-base-300 text-sm', {
        children: [tab('Table', true), tab('Board'), tab('Timeline'), tab('Calendar')],
      }),
      el('div', 'mt-4 overflow-hidden rounded-lg border border-base-300 text-sm', {
        children: [
          el('div', 'grid grid-cols-[1.6fr_0.9fr_1fr] bg-[#FBFBFA] px-3 py-2 text-xs font-medium text-base-content/40', {
            children: [el('span', '', { text: 'Task' }), el('span', '', { text: 'Status' }), el('span', '', { text: 'Owner' })],
          }),
          tableRow('Launch AI Meeting Notes', statusPill('In progress', '#DDEDEA', '#1C6B5B'), ownerDot('#9B51E0', 'Priya')),
          tableRow('Enterprise Search rollout', statusPill('Planning', '#FBECDD', '#9F5C2E'), ownerDot('#F2994A', 'Dev')),
          tableRow('Q2 board deck', statusPill('In review', '#DDEBF1', '#1F5C82'), ownerDot('#2D9CDB', 'Sam')),
          tableRow('Universal search GA', statusPill('Done', '#E7E7E5', '#73726E'), ownerDot('#27AE60', 'Mia')),
          el('div', 'grid grid-cols-[1.6fr_0.9fr_1fr] items-center border-t border-base-300 px-3 py-2.5 text-base-content/40', {
            children: [el('span', '', { text: '＋ New' }), el('span', '', {}), el('span', '', {})],
          }),
        ],
      }),
    ],
  });

export function preview(): BuilderNode {
  return node('Section', {
    box: { name: 'Workspace preview', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      el('div', 'relative w-full', {
        children: [
          el('span', 'absolute -left-1 top-10 z-10 hidden h-9 w-9 -rotate-12 items-center justify-center rounded-full bg-[#EF6F5C] text-lg shadow-lg @3xl:inline-flex', { text: '🌟' }),
          el('span', 'absolute -right-1 top-24 z-10 hidden h-9 w-9 rotate-12 items-center justify-center rounded-full bg-[#FFC93C] text-lg shadow-lg @3xl:inline-flex', { text: '⚡' }),
          el('div', 'overflow-hidden rounded-2xl bg-base-100 shadow-2xl ring-1 ring-black/5', {
            children: [
              // Chrome bar — traffic lights + a URL pill.
              el('div', 'flex items-center gap-2 border-b border-base-300 bg-base-200 px-4 py-3', {
                children: [
                  el('span', 'h-3 w-3 rounded-full bg-[#FF5F57]', {}),
                  el('span', 'h-3 w-3 rounded-full bg-[#FEBC2E]', {}),
                  el('span', 'h-3 w-3 rounded-full bg-[#28C840]', {}),
                  el('div', 'ml-3 hidden h-6 flex-1 items-center rounded-md bg-base-100 px-3 text-xs text-base-content/40 ring-1 ring-base-300 @sm:flex', { text: 'mosaic.so / Acme HQ' }),
                ],
              }),
              el('div', 'flex min-h-[440px]', { children: [sidebar(), mainPane()] }),
            ],
          }),
        ],
      }),
    ],
  });
}

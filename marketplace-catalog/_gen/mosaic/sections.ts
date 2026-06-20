// Mosaic generator — reusable section builders shared across the layout + pages: the
// standard full-bleed band shell, the big display heading, the small card label, the
// bento copy-half (label · heading · arrow pill), the footer column, and the small
// quote / stat cells. Each returns a BuilderNode and calls node()/el()/atom() when
// invoked, so the shared id counter only advances when manifest.ts assembles the trees.
// Class strings track docs/mockups/examples/notion.html.

import { arrowPill } from './media';
import { atom, el, node, type BuilderNode } from './_kit';

// ── Section band shell ────────────────────────────────────────────────────────────

/** A standard page section — a full-bleed band painting an optional surface, wrapping
 *  a contained `max-w-site` column that stacks its children. Headings sit LEFT (the
 *  mockup's section heads are left-aligned); pass `align: 'center'` for the hero/CTA
 *  bands. `surface: 'subtle'` paints the cream alternating band. */
export function band(opts: {
  name: string;
  surface?: 'none' | 'subtle' | 'inverse';
  align?: 'start' | 'center';
  gap?: 'sm' | 'md' | 'lg';
  cls?: string;
  children: BuilderNode[];
}): BuilderNode {
  const centered = opts.align === 'center';
  return node('Section', {
    box: {
      name: opts.name,
      surface: opts.surface ?? 'none',
      padding: 'xl',
      backgroundWidth: 'full',
      contentWidth: 'contained',
      ...(centered ? { align: 'center' as const } : {}),
    },
    layout: {
      direction: 'stack',
      gap: opts.gap ?? 'lg',
      alignItems: centered ? 'center' : 'start',
      ...(centered ? { justify: 'center' as const } : {}),
    },
    cls: opts.cls,
    children: opts.children,
  });
}

// ── Typography ────────────────────────────────────────────────────────────────────

/** The big section heading — display weight, tight tracking, ink. */
export const displayHeading = (text: string, cls = ''): BuilderNode =>
  atom('Heading', `text-4xl font-bold tracking-tight text-[#191918] ${cls}`.trim(), {
    level: 'h2',
    text,
  });

/** A small muted product-area label that sits above a bento card's heading (sentence
 *  case — NOT an uppercase kicker). */
export const cardLabel = (text: string): BuilderNode =>
  atom('Text', 'text-sm text-base-content/60', { variant: 'body', text });

// ── Bento copy half ───────────────────────────────────────────────────────────────

/** The white copy column of a bento card: a small label, a semibold heading, and the
 *  circular arrow "open" affordance. The colored screenshot panel is the sibling. */
export const bentoCopy = (label: string, heading: string, cls = ''): BuilderNode =>
  el('div', `flex flex-col bg-base-100 p-7 ${cls}`.trim(), {
    children: [
      cardLabel(label),
      atom('Heading', 'mt-1 text-2xl font-semibold text-[#191918]', { level: 'h3', text: heading }),
      arrowPill('mt-5'),
    ],
  });

// ── Small cells ─────────────────────────────────────────────────────────────────

/** A small testimonial card — a cream tile with a short quote (the 3-up proof row). */
export const quoteCard = (text: string): BuilderNode =>
  el('div', 'rounded-2xl bg-base-200 p-6 text-sm leading-relaxed text-base-content', { text });

/** A bordered stat cell — a big figure over a small caption (the 4-up proof grid). */
export const statCell = (value: string, label: string): BuilderNode =>
  el('div', 'flex flex-col rounded-xl border border-base-300 p-5', {
    children: [
      el('p', 'text-3xl font-bold text-[#191918]', { text: value }),
      el('p', 'mt-1 text-xs text-base-content/60', { text: label }),
    ],
  });

// ── Footer column ─────────────────────────────────────────────────────────────────

/** One footer link column — a bold head over a list of muted hover-ink links. */
export const footerCol = (title: string, links: Array<{ label: string; href: string }>): BuilderNode =>
  el('div', 'flex flex-col', {
    children: [
      el('h4', 'text-sm font-semibold text-[#191918]', { text: title }),
      el('ul', 'mt-4 flex flex-col gap-3 text-sm text-base-content/60', {
        children: links.map((l) =>
          el('li', '', {
            children: [el('a', 'transition-colors hover:text-[#191918]', { text: l.label, attrs: { href: l.href } })],
          })
        ),
      }),
    ],
  });

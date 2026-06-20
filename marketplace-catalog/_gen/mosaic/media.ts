// Mosaic generator — the small reusable VISUAL primitives the pages compose from:
// CTAs, the circular arrow/play "pill" button, colored icon tiles, ringed avatars,
// skeleton bars, status pills, and owner dots. Each returns a BuilderNode and calls
// the kit helpers when invoked (not at import), so the shared id counter only advances
// when manifest.ts assembles the trees. Class strings track the mockup
// (docs/mockups/examples/notion.html).

import { atom, el, type BuilderNode } from './_kit';

// ── Buttons ──────────────────────────────────────────────────────────────────────
// A navigating CTA is an anchor wearing the Surface button recipe (the catalog idiom
// for a button-that-navigates), so it renders identically in the storefront + editor
// and is restyleable from the inspector. `variant` picks the recipe color×treatment.

type BtnVariant = 'primary' | 'dark' | 'ghost' | 'soft';
const BTN_RECIPE: Record<BtnVariant, string> = {
  primary: 'st-c-primary st-v-solid', // solid blue — the "Get Mosaic free" CTA
  dark: 'st-c-neutral st-v-solid', // solid ink
  ghost: 'st-c-neutral st-v-outline', // white + hairline border (the mockup's btn-ghost)
  soft: 'st-c-primary st-v-soft', // tinted blue
};

/** A navigating button (an `<a>` styled with the button recipe). */
export const btn = (
  label: string,
  href: string,
  opts: { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; cls?: string } = {}
): BuilderNode =>
  el('a', `st-btn ${BTN_RECIPE[opts.variant ?? 'primary']} st-btn--sz-${opts.size ?? 'md'} ${opts.cls ?? ''}`.trim(), {
    text: label,
    attrs: { href },
  });

// ── The circular "pill" button (the mockup `.pill-btn`) ───────────────────────────
// An ink disc with a white glyph — an arrow (the bento "open" affordance) or a play
// triangle (the Custom Agents card). Decorative; carries no link in the mockup.

const pill = (iconName: string, cls: string): BuilderNode =>
  el('span', `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#191918] text-white ${cls}`.trim(), {
    children: [atom('Icon', 'h-4 w-4', { name: iconName })],
  });

export const arrowPill = (cls = ''): BuilderNode => pill('arrow-right', cls);
export const playPill = (cls = ''): BuilderNode => pill('play', cls);

// ── Colored icon tile (agent rows, capability cards) ──────────────────────────────

/** A small rounded square filled with a bento color, an emoji centered in white. */
export const iconTile = (emoji: string, bgHex: string, cls = ''): BuilderNode =>
  el('span', `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[${bgHex}] text-white ${cls}`.trim(), {
    text: emoji,
  });

// ── Ringed avatar (the hero cluster) ──────────────────────────────────────────────

/** One overlapping avatar — a colored disc ringed against the white page so the
 *  overlap reads cleanly. `text` is the emoji/glyph it carries. */
export const avatar = (emoji: string, bgCls: string, textCls = 'text-xl'): BuilderNode =>
  el('span', `inline-flex h-11 w-11 items-center justify-center rounded-full ${bgCls} ${textCls} ring-4 ring-base-100`, {
    text: emoji,
  });

// ── Skeleton bar (bento "screenshot" panels) ──────────────────────────────────────

/** A rounded placeholder bar standing in for a line of UI inside a screenshot tile.
 *  `tone` is the fill (dark-on-color or white-on-color). */
export const skel = (wCls: string, tone = 'bg-black/10', cls = ''): BuilderNode =>
  el('div', `h-2.5 ${wCls} rounded ${tone} ${cls}`.trim(), {});

// ── Status pill + owner dot (the faux database table) ─────────────────────────────

/** A soft status pill (In progress / Planning / In review / Done) in the table. */
export const statusPill = (label: string, bgHex: string, textHex: string): BuilderNode =>
  el('span', `inline-flex rounded-md bg-[${bgHex}] px-2 py-0.5 text-xs text-[${textHex}]`, { text: label });

/** A colored owner dot beside a name. */
export const ownerDot = (colorHex: string, name: string): BuilderNode =>
  el('span', 'inline-flex items-center gap-1.5 text-[#73726E]', {
    children: [el('span', `h-2.5 w-2.5 shrink-0 rounded-full bg-[${colorHex}]`, {}), el('span', '', { text: name })],
  });

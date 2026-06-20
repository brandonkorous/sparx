// Forge generator — reusable SECTION-level builders shared across the layout + pages:
// the standard full-bleed band shell, the slash-led display heading, the heading+blurb
// section intro, the eyebrow status line, the case-study project card (gradient thumb +
// category pill + up-right affordance), the numbered service row, the process phase
// card, and the testimonial quote figure. Each returns a BuilderNode and calls
// node()/el() when invoked, so the shared id counter only advances when manifest.ts
// assembles the trees. Class strings track docs/mockups/examples/500designs.html.

import { arrowUpRight } from './media';
import { el, node, type BuilderNode } from './_kit';

// ── Section band shell ──────────────────────────────────────────────────────────────

/** A standard page section — a full-bleed band painting an optional surface, wrapping a
 *  contained `max-w-site` column that stacks its children. `surface: 'subtle'` paints the
 *  recessed near-black (`nighter`) alternating band; pass `cls` for a one-off band fill
 *  (the acid contact band). `align: 'center'` centers the hero / CTA bands. */
export function band(opts: {
  name: string;
  surface?: 'none' | 'subtle' | 'brand';
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

// ── Typography ──────────────────────────────────────────────────────────────────────

/** The acid slash that leads brand + headings (skewed; degrades to upright). */
const slashGlyph = (cls = ''): BuilderNode =>
  el('span', `mr-2 inline-block -skew-x-12 font-bold text-[#C6F24E] ${cls}`.trim(), { text: '/' });

/** The big section heading — a raw `<h2>` so the inline slash can lead it (the Heading
 *  atom renders only flat text). Display font, medium weight, tight tracking, cream. */
export const sectionHeading = (text: string, cls = ''): BuilderNode =>
  el('h2', `font-heading text-4xl font-medium tracking-tight text-[#ECE7DD] @2xl:text-5xl ${cls}`.trim(), {
    children: [slashGlyph(), el('span', '', { text })],
  });

/** The eyebrow status line — an acid dot beside a muted label (the mockup's
 *  "Brand · Web · Growth — since 2014"). NOT an uppercase kicker. */
export const eyebrow = (text: string): BuilderNode =>
  el('p', 'flex items-center gap-3 text-sm font-medium tracking-wide text-base-content/60', {
    children: [
      el('span', 'inline-block h-2 w-2 shrink-0 rounded-full bg-[#C6F24E]', {}),
      el('span', '', { text }),
    ],
  });

/** A secondary-page hero band: an eyebrow, a big slash-led `<h1>`, and a supporting
 *  blurb. The single consistent top for Work / Services / About / Insights / Careers /
 *  Contact, so every route opens the same way the home page does. */
export const pageHero = (kicker: string, title: string, blurb: string): BuilderNode =>
  band({
    name: 'Page hero',
    gap: 'md',
    children: [
      eyebrow(kicker),
      el('h1', 'font-heading max-w-4xl text-[2.5rem] font-medium leading-[1.02] tracking-tight text-[#ECE7DD] @2xl:text-6xl', {
        children: [slashGlyph('mr-3'), el('span', '', { text: title })],
      }),
      el('p', 'max-w-2xl text-lg leading-relaxed text-base-content/70', { text: blurb }),
    ],
  });

/** A section intro row: the slash heading beside a right-aligned supporting blurb (the
 *  "Selected work" / "What we do" heads). Stacks on a narrow container. */
export const sectionIntro = (heading: string, blurb: string): BuilderNode =>
  el('div', 'flex w-full flex-col gap-6 @3xl:flex-row @3xl:items-end @3xl:justify-between', {
    children: [
      sectionHeading(heading, 'max-w-2xl'),
      el('p', 'max-w-md text-base leading-relaxed text-base-content/70', { text: blurb }),
    ],
  });

// ── Case-study project card ───────────────────────────────────────────────────────────
// The work-gallery card: a tall decorated thumbnail with a floating category pill over a
// title + meta row and a circular up-right affordance that lights acid on hover. The
// `thumb` is one of the gradient art layers below.

const categoryPill = (category: string): BuilderNode =>
  el('span', 'absolute left-6 top-6 rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-[#ECE7DD] backdrop-blur', {
    text: category,
  });

export const project = (opts: {
  category: string;
  title: string;
  meta: string;
  thumb: BuilderNode;
  href?: string;
}): BuilderNode =>
  el('article', 'group overflow-hidden rounded-[1.5rem] border border-white/5 bg-[#221D16]', {
    children: [
      el('div', 'relative h-72 overflow-hidden @sm:h-80', { children: [opts.thumb, categoryPill(opts.category)] }),
      el('a', 'flex items-center justify-between p-7', {
        attrs: { href: opts.href ?? '/work' },
        children: [
          el('div', '', {
            children: [
              el('h3', 'font-heading text-2xl font-semibold text-[#ECE7DD]', { text: opts.title }),
              el('p', 'mt-1 text-sm text-base-content/60', { text: opts.meta }),
            ],
          }),
          el('span', 'grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 text-[#ECE7DD] transition-colors group-hover:bg-[#C6F24E] group-hover:text-[#15120D]', {
            children: [arrowUpRight()],
          }),
        ],
      }),
    ],
  });

// ── Gradient thumb art (the design's playful interior — baked classes, not theme) ──────
// Each thumb is one absolute gradient layer that scales on card hover, holding a centered
// decorative shape. Distinct per project so the gallery reads varied (the mockup's
// fintech ring / consumer bars / SaaS tile grid / healthtech rings).

const thumbBg = (gradient: string, shape: BuilderNode): BuilderNode =>
  el('div', `absolute inset-0 transition-transform duration-500 group-hover:scale-105 ${gradient}`, {
    children: [el('div', 'absolute inset-0 flex items-center justify-center', { children: [shape] })],
  });

export const thumbRing = (): BuilderNode =>
  thumbBg(
    'bg-linear-to-br from-[#1F2B1A] to-[#0A0A0A]',
    el('div', 'h-40 w-40 rotate-12 rounded-[1.25rem] border-[10px] border-[#C6F24E]/80', {})
  );

export const thumbBars = (): BuilderNode =>
  thumbBg(
    'bg-linear-to-br from-[#3A1D12] to-[#120A06]',
    el('div', 'flex items-end gap-3', {
      children: [
        el('div', 'h-44 w-12 rounded-full bg-[#FF6A3D]', {}),
        el('div', 'h-32 w-12 rounded-full bg-[#FF6A3D]/60', {}),
        el('div', 'h-24 w-12 rounded-full bg-[#FF6A3D]/35', {}),
      ],
    })
  );

export const thumbGrid = (): BuilderNode =>
  thumbBg(
    'bg-linear-to-br from-[#15233A] to-[#070A12]',
    el('div', 'grid grid-cols-3 gap-3', {
      children: [
        el('span', 'h-14 w-14 rounded-2xl bg-[#5C97E8]/80', {}),
        el('span', 'h-14 w-14 rounded-2xl bg-[#5C97E8]/40', {}),
        el('span', 'h-14 w-14 rounded-2xl bg-[#5C97E8]/60', {}),
        el('span', 'h-14 w-14 rounded-2xl bg-[#5C97E8]/30', {}),
        el('span', 'h-14 w-14 rounded-2xl bg-[#ECE7DD]', {}),
        el('span', 'h-14 w-14 rounded-2xl bg-[#5C97E8]/40', {}),
        el('span', 'h-14 w-14 rounded-2xl bg-[#5C97E8]/50', {}),
        el('span', 'h-14 w-14 rounded-2xl bg-[#5C97E8]/30', {}),
        el('span', 'h-14 w-14 rounded-2xl bg-[#5C97E8]/70', {}),
      ],
    })
  );

export const thumbRings = (): BuilderNode =>
  thumbBg(
    'bg-linear-to-br from-[#2A1538] to-[#0C0612]',
    el('div', 'relative h-40 w-40', {
      children: [
        el('div', 'absolute inset-0 rounded-full border-[3px] border-[#D957C8]/70', {}),
        el('div', 'absolute inset-6 rounded-full border-[3px] border-[#D957C8]/45', {}),
        el('div', 'absolute inset-12 rounded-full bg-[#D957C8]/80', {}),
      ],
    })
  );

// ── Numbered service row ──────────────────────────────────────────────────────────────

/** One discipline row — a number, a big title that lights acid on hover, and a blurb.
 *  Wrap a stack of these in `serviceList()` for the divide hairlines. */
export const serviceRow = (num: string, title: string, desc: string): BuilderNode =>
  el('div', 'group grid items-start gap-3 py-9 @3xl:grid-cols-[7rem_1fr_22rem] @3xl:gap-6', {
    children: [
      el('span', 'font-heading text-lg text-base-content/50', { text: num }),
      el('h3', 'font-heading text-3xl font-semibold text-[#ECE7DD] transition-colors group-hover:text-[#C6F24E] @2xl:text-4xl', {
        text: title,
      }),
      el('p', 'text-base leading-relaxed text-base-content/70', { text: desc }),
    ],
  });

/** The divide-ruled wrapper for a stack of service rows. */
export const serviceList = (rows: BuilderNode[]): BuilderNode =>
  el('div', 'w-full divide-y divide-white/10 border-y border-white/10', { children: rows });

// ── Process phase card ────────────────────────────────────────────────────────────────

export const phaseCard = (phase: string, title: string, desc: string): BuilderNode =>
  el('div', 'rounded-[1.5rem] border border-white/10 bg-[#221D16] p-8', {
    children: [
      el('span', 'font-heading text-sm text-[#C6F24E]', { text: phase }),
      el('h3', 'font-heading mt-4 text-2xl font-semibold text-[#ECE7DD]', { text: title }),
      el('p', 'mt-3 text-sm leading-relaxed text-base-content/70', { text: desc }),
    ],
  });

// ── Testimonial quote figure ─────────────────────────────────────────────────────────

export const quoteFigure = (opts: {
  quote: string;
  initials: string;
  name: string;
  role: string;
  avatarCls: string;
}): BuilderNode =>
  el('figure', 'flex flex-col justify-between rounded-[1.5rem] border border-white/10 bg-[#221D16] p-8', {
    children: [
      el('blockquote', 'font-heading text-xl leading-snug text-[#ECE7DD]', { text: `“${opts.quote}”` }),
      el('figcaption', 'mt-8 flex items-center gap-3', {
        children: [
          el('span', `grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-[#15120D] ${opts.avatarCls}`, {
            text: opts.initials,
          }),
          el('span', 'text-sm', {
            children: [
              el('span', 'block font-semibold text-[#ECE7DD]', { text: opts.name }),
              el('span', 'text-base-content/60', { text: opts.role }),
            ],
          }),
        ],
      }),
    ],
  });

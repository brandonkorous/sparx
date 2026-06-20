// Forge generator — the small reusable VISUAL ATOMS the pages compose from: pill CTAs,
// the signature acid slash glyph, the inline arrow SVGs, the awards-row item, a bordered
// stat cell, and the footer link column. Each returns a BuilderNode and calls the kit
// helpers when invoked (not at import), so the shared id counter only advances when
// manifest.ts assembles the trees. Section-level builders (project cards, the case-study
// showcase, service rows, process cards, quote figures) live in sections.ts. Class
// strings track docs/mockups/examples/500designs.html.

import { el, type BuilderNode } from './_kit';

// ── Pill buttons ───────────────────────────────────────────────────────────────────
// A navigating CTA is an anchor wearing the Surface button recipe (the catalog idiom for
// a button-that-navigates), so it renders identically in the storefront + editor and is
// restyleable from the inspector. `rounded-full` (utilities layer) overrides the field
// radius for the mockup's pill shape. `variant` picks the recipe color×treatment.

type BtnVariant = 'primary' | 'cream' | 'outline' | 'dark';
const BTN_RECIPE: Record<BtnVariant, string> = {
  primary: 'st-c-primary st-v-solid', // acid bg, ink text — the hero "Start a project" CTA
  cream: 'st-c-neutral st-v-solid', // cream bg, ink text — the header "Let's talk"
  outline: 'st-c-neutral st-v-outline', // transparent, cream text + hairline — "View our work"
  dark: 'bg-[#15120D] text-[#ECE7DD] transition-colors hover:bg-black', // ink pill on the acid band
};

/** A navigating pill button (an `<a>` styled with the button recipe). Pass `icon` to
 *  trail an inline arrow inside the pill (the mockup's `Start a project →`). */
export const btn = (
  label: string,
  href: string,
  opts: { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; cls?: string; icon?: BuilderNode } = {}
): BuilderNode => {
  const cls =
    `st-btn ${BTN_RECIPE[opts.variant ?? 'primary']} st-btn--sz-${opts.size ?? 'md'} rounded-full ${opts.cls ?? ''}`.trim();
  if (opts.icon) {
    return el('a', cls, { attrs: { href }, children: [el('span', '', { text: label }), opts.icon] });
  }
  return el('a', cls, { text: label, attrs: { href } });
};

// ── The signature slash ──────────────────────────────────────────────────────────
// The acid forward-slash that marks the brand lockup AND leads every section heading in
// the mockup. A skewed inline glyph; `-skew-x-12` echoes the design's italic lean (it
// degrades gracefully to an upright slash if the tenant bans transforms).

export const slash = (cls = '', colorCls = 'text-[#C6F24E]'): BuilderNode =>
  el('span', `inline-block -skew-x-12 font-bold ${colorCls} ${cls}`.trim(), { text: '/' });

// ── Inline arrow SVGs (the mockup's button + card arrows) ──────────────────────────

/** The right-arrow that trails CTAs (`→`). */
export const arrowRight = (cls = 'h-4 w-4'): BuilderNode =>
  el('svg', cls, {
    attrs: { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    children: [
      el('path', '', { attrs: { d: 'M5 12h14M13 6l6 6-6 6', strokeLinecap: 'round', strokeLinejoin: 'round' } }),
    ],
  });

/** The up-right arrow inside a work card's circular affordance (`↗`). */
export const arrowUpRight = (cls = 'h-4 w-4'): BuilderNode =>
  el('svg', cls, {
    attrs: { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
    children: [
      el('path', '', { attrs: { d: 'M7 17 17 7M9 7h8v8', strokeLinecap: 'round', strokeLinejoin: 'round' } }),
    ],
  });

// ── Awards row item ────────────────────────────────────────────────────────────────

/** One award / recognition line — an acid diamond glyph beside the label (the strip
 *  under the logo marquee). */
export const awardItem = (text: string): BuilderNode =>
  el('span', 'flex items-center gap-2 text-sm text-base-content/70', {
    children: [el('span', 'text-[#C6F24E]', { text: '◆' }), el('span', '', { text })],
  });

// ── Bordered stat cell (the 4-up proof band) ───────────────────────────────────────

/** A big display figure over a small caption. `value` is the headline number; `accent`
 *  optionally tints a trailing unit (the mockup's `240` ink + `+` acid). `suffix` is the
 *  small unit; `suffixCls` its color. */
export const statCell = (
  value: string,
  label: string,
  opts: { suffix?: string; suffixCls?: string; valueCls?: string } = {}
): BuilderNode =>
  el('div', '', {
    children: [
      el('p', `font-heading text-5xl font-medium tracking-tight @2xl:text-6xl ${opts.valueCls ?? 'text-[#ECE7DD]'}`, {
        children: [
          el('span', '', { text: value }),
          ...(opts.suffix ? [el('span', opts.suffixCls ?? 'text-[#C6F24E]', { text: opts.suffix })] : []),
        ],
      }),
      el('p', 'mt-3 text-sm text-base-content/60', { text: label }),
    ],
  });

// ── Footer column ─────────────────────────────────────────────────────────────────

/** One footer link column — a bold head over a list of muted hover-cream links. */
export const footerCol = (
  title: string,
  links: Array<{ label: string; href: string }>
): BuilderNode =>
  el('div', 'flex flex-col', {
    children: [
      el('h4', 'font-heading text-sm font-semibold text-[#ECE7DD]', { text: title }),
      el('ul', 'mt-5 flex flex-col gap-3 text-sm text-base-content/60', {
        children: links.map((l) =>
          el('li', '', {
            children: [
              el('a', 'transition-colors hover:text-[#ECE7DD]', { text: l.label, attrs: { href: l.href } }),
            ],
          })
        ),
      }),
    ],
  });

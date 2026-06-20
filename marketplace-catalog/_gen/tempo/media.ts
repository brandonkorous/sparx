// Tempo generator — the reusable VISUAL primitives the pages compose from: the signature
// uppercase arrow CTA, the underline arrow-link, the inline arrow + chevron icons, the
// "»" motion-mark stamp (Tempo's three-stripes replacement), and the data-URI product
// image (a pale brand-gradient panel + the product emoji — the Farm Fresh `photoSvg`
// precedent: no remote load, so it always resolves). Each builder returns a BuilderNode
// and calls the kit helpers when invoked (not at import), so the shared id counter only
// advances when manifest.ts assembles the trees. Class strings track
// docs/mockups/examples/adidas.html.

import { atom, el, type BuilderNode } from './_kit';
import { CAMPAIGN } from './theme';

// ── The signature CTA ──────────────────────────────────────────────────────────────
// Bold UPPERCASE Archivo, sharp corners, an optional trailing arrow — the adidas CTA
// voice. Tone classes use THEME ROLES (neutral = ink, base-100 = paper) so the buttons
// re-theme on a fork; only the structure is baked. `ink` is the default black button;
// `paper`/`outlinePaper` are the variants for dark + colored bands.

type BtnTone = 'ink' | 'paper' | 'outlineInk' | 'outlinePaper';
const BTN_TONE: Record<BtnTone, string> = {
  ink: 'bg-neutral text-neutral-content hover:bg-neutral/85',
  paper: 'bg-base-100 text-base-content hover:bg-base-100/85',
  outlineInk: 'border-2 border-neutral text-neutral hover:bg-neutral hover:text-neutral-content',
  outlinePaper: 'border-2 border-base-100 text-base-100 hover:bg-base-100/10',
};

/** A navigating CTA (an `<a>`) in the signature uppercase Archivo style. Pass `icon` to
 *  trail an inline arrow (the mockup's `Shop Now →`). */
export const btn = (
  label: string,
  href: string,
  opts: { tone?: BtnTone; size?: 'sm' | 'md'; cls?: string; icon?: BuilderNode } = {}
): BuilderNode => {
  const pad = opts.size === 'sm' ? 'px-5 py-2.5 text-xs' : 'px-7 py-3.5 text-sm';
  const cls =
    `inline-flex items-center justify-center gap-2 font-heading font-bold uppercase tracking-wide transition-colors ${pad} ${BTN_TONE[opts.tone ?? 'ink']} ${opts.cls ?? ''}`.trim();
  if (opts.icon) {
    return el('a', cls, { attrs: { href }, children: [el('span', '', { text: label }), opts.icon] });
  }
  return el('a', cls, { text: label, attrs: { href } });
};

// ── The arrow-link (mockup `.arrow-link`) ───────────────────────────────────────────
// An uppercase bold label cut by a 2px underline, trailing an arrow that slides right on
// hover. The link wears its own `group/al` so the arrow animates without affecting the
// card's hover. `colorCls` recolors it for dark tiles (default inherits the surface ink).

export const arrowLink = (
  label: string,
  href: string,
  opts: { colorCls?: string; cls?: string } = {}
): BuilderNode =>
  el(
    'a',
    `group/al inline-flex w-fit items-center gap-2 border-b-2 border-current pb-1 font-heading text-xs font-bold uppercase tracking-wide ${opts.colorCls ?? ''} ${opts.cls ?? ''}`.trim(),
    {
      attrs: { href },
      children: [
        el('span', '', { text: label }),
        atom('Icon', 'h-3.5 w-3.5 transition-transform group-hover/al:translate-x-1', { name: 'arrow-right' }),
      ],
    }
  );

// ── Inline icons ─────────────────────────────────────────────────────────────────────

/** The right-arrow that trails CTAs (lucide, bundled — reliable). */
export const arrowRight = (cls = 'h-4 w-4'): BuilderNode => atom('Icon', cls, { name: 'arrow-right' });

/** A named lucide glyph (header search/account/bag/menu, footer globe/chevron). */
export const icon = (name: string, cls = 'h-6 w-6'): BuilderNode => atom('Icon', cls, { name });

// ── The "»" motion-mark (Tempo's signature stamp) ───────────────────────────────────
// Replaces the mockup's trademarked three-stripes wherever a mark is stamped — campaign
// tiles, the membership lockup. A single bold forward double-chevron glyph (reliable
// everywhere, unlike a multi-element skew), aria-hidden. `colorCls` sets the ink/white
// tone for the surface it sits on.

export const motionMark = (cls = 'text-xl', colorCls = ''): BuilderNode =>
  el('span', `inline-block font-heading font-black leading-none ${colorCls} ${cls}`.trim(), { text: '»' });

// ── Product imagery (data-URI SVG panels) ───────────────────────────────────────────
// A product "photo" as a self-contained SVG data URI: a PALE tint of the product's
// campaign color easing to soft gray, with the product emoji centered — adidas-style
// light product shots with a faint brand wash, but as a real <img> so a bound
// `item.images` (Best Sellers grid, PDP) renders it. No network, so it always resolves;
// the whole URI stays well under the `media_assets.key` 1024-char cap. The tenant swaps
// these for real product photography post-install.

type ProductSeed =
  | 'runner'
  | 'court'
  | 'trail'
  | 'street'
  | 'cleat'
  | 'ball'
  | 'jersey'
  | 'jacket'
  | 'tee'
  | 'pant'
  | 'pack'
  | 'cap';

const PRODUCT_EMOJI: Record<ProductSeed, string> = {
  runner: '👟',
  court: '👟',
  trail: '🥾',
  street: '👟',
  cleat: '👟',
  ball: '⚽',
  jersey: '👕',
  jacket: '🧥',
  tee: '👕',
  pant: '👖',
  pack: '🎒',
  cap: '🧢',
};

const PRODUCT_HEX: Record<ProductSeed, string> = {
  runner: CAMPAIGN.blue,
  court: CAMPAIGN.violet,
  trail: CAMPAIGN.rust,
  street: CAMPAIGN.teal,
  cleat: CAMPAIGN.green,
  ball: CAMPAIGN.crimson,
  jersey: CAMPAIGN.blue,
  jacket: CAMPAIGN.royal,
  tee: CAMPAIGN.amber,
  pant: CAMPAIGN.teal,
  pack: CAMPAIGN.violet,
  cap: CAMPAIGN.crimson,
};

export const emojiOf = (seed: string): string => PRODUCT_EMOJI[seed as ProductSeed] ?? '👟';
const hexOf = (seed: string): string => PRODUCT_HEX[seed as ProductSeed] ?? CAMPAIGN.blue;

/** Lighten a `#rrggbb` toward white by `amt` (0..1). */
const lighten = (hex: string, amt: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number): number => Math.round(c + (255 - c) * amt);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

/** A product photo as a self-contained SVG data URI (pale campaign wash + emoji). */
export const productSvg = (seed: string): string => {
  const base = hexOf(seed);
  const tint = lighten(base, 0.9); // near-white spotlight behind the product
  const floor = lighten(base, 0.74); // a faint colored field at the edges
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">` +
    `<defs><radialGradient id="g" cx="0.5" cy="0.42" r="0.75">` +
    `<stop offset="0" stop-color="${tint}"/><stop offset="1" stop-color="${floor}"/>` +
    `</radialGradient></defs>` +
    `<rect width="800" height="800" fill="url(#g)"/>` +
    `<text x="400" y="430" font-size="360" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">${emojiOf(seed)}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

// ── Campaign gradients (baked utility classes, not theme roles) ─────────────────────
// The design's playful "team color" gradients, as Tailwind v4 linear-gradient utility
// classes (surface-compile allows `bg-linear-to-*` + `from/via/to-[#hex]`; an inline
// `style` attr does NOT pass the element whitelist). The mockup's ~150–160° angles all
// read as "to bottom-right", so every tile uses `bg-linear-to-br`. Named so the colorway
// tiles + category tiles + editorial panels stay consistent.

export const GRAD = {
  fire: `bg-linear-to-br from-[${CAMPAIGN.gold}] via-[${CAMPAIGN.crimson}] to-[${CAMPAIGN.blue}]`,
  blueDeep: `bg-linear-to-br from-[#0f172a] to-[${CAMPAIGN.blue}]`,
  steel: `bg-linear-to-br from-[#334155] to-[#0f172a]`,
  ink: `bg-linear-to-br from-[#111111] to-[#3f3f46]`,
  sky: `bg-linear-to-br from-[#0ea5e9] to-[${CAMPAIGN.blue}]`,
  pitch: `bg-linear-to-br from-[${CAMPAIGN.green}] to-[#052e16]`,
  sunset: `bg-linear-to-br from-[${CAMPAIGN.amber}] to-[${CAMPAIGN.crimson}]`,
  grape: `bg-linear-to-br from-[${CAMPAIGN.violet}] to-[${CAMPAIGN.pink}]`,
  rust: `bg-linear-to-br from-[${CAMPAIGN.rust}] to-[#451a03]`,
  ruby: `bg-linear-to-br from-[${CAMPAIGN.crimson}] to-[#450a0a]`,
  teal: `bg-linear-to-br from-[${CAMPAIGN.teal}] to-[#082f3a]`,
} as const;

// ── Decorative gradient glyph panel (static editorial visuals) ───────────────────────

/** A bold campaign panel: a baked gradient with a big product/sport emoji centered — the
 *  editorial-banner + story-page "hero product" stand-in (NOT bound to a record, so it's
 *  a baked `el()` band, not a productSvg). `gradientCls` is one of GRAD. */
export const glyphPanel = (emoji: string, gradientCls: string, cls = ''): BuilderNode =>
  el('div', `relative flex items-center justify-center overflow-hidden ${gradientCls} ${cls}`.trim(), {
    children: [el('span', 'text-[7rem] leading-none drop-shadow-2xl @2xl:text-[10rem]', { text: emoji })],
  });

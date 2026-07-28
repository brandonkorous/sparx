// Color math for Token Model v2 (docs/33-token-model-v2.md §4).
//
// Tenants store base colors as hex. The only derivation that MUST be computed
// at compile time (rather than expressed as a CSS color-mix) is the auto-contrast
// `-content` pair: picking a text/icon color that clears WCAG AA on an arbitrary
// tenant color can't be done reliably in pure CSS. Everything else (hover,
// active, tint) is emitted as a `color-mix(in oklab …)` expression by the CSS
// layer, so this module stays small: parse + relative luminance + contrast.

export interface Rgb {
  r: number; // 0–255
  g: number;
  b: number;
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Normalize `#abc` / `ABCDEF` / `#aabbcc` → lowercase `#aabbcc`. Returns null
 *  for anything that isn't a 3- or 6-digit hex (callers fall back). */
export function normalizeHex(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = HEX_RE.exec(input.trim());
  if (!m?.[1]) return null;
  let hex = m[1].toLowerCase();
  if (hex.length === 3) hex = hex.replace(/(.)/g, '$1$1');
  return `#${hex}`;
}

/** Parse a hex string to 0–255 RGB. Falls back to black for invalid input so
 *  derivation never throws on bad data (it's degraded, not crashed). */
export function hexToRgb(input: string): Rgb {
  const hex = normalizeHex(input) ?? '#000000';
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/* ── OKLCH, because half the colors on this platform are written in it ──────── */

// A tenant's OWN colors are hex — that is the storage format this module was built
// for, and the compiler above never sees anything else. But a silica THEME is not a
// tenant color set: `THEME_PRESETS` writes every token as `oklch(98% 0.003 250)`, an
// authored theme keeps whatever the Design inspector produced, and both flow into
// `Theme.tokens` and out to the live stylesheet.
//
// `hexToRgb` falls back to BLACK for anything it cannot parse. That is the right
// degradation for a malformed tenant hex and completely wrong for an OKLCH token: a
// contrast check fed silica's default light theme would read every single color as
// black, conclude that black-on-black is unreadable, and report a flawless theme as
// broken on every element of every page. Parsing the format is the only honest
// option — refusing to judge would be second best, and guessing is not on the list.

const OKLCH_RE = /^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)(?:deg)?\s*(?:\/.*)?\)$/i;
const RGB_RE = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i;

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

// Linear-light sRGB channel (0–1) → gamma-encoded 0–255.
function encodeGamma(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return clamp255(v * 255);
}

/** OKLCH → sRGB, via OKLab and the linear-sRGB matrix (Björn Ottosson's Oklab).
 *  `l` is 0–1 (or a percentage), `c` is chroma, `h` is degrees. Out-of-gamut
 *  results clamp per channel, which is what a browser does too. */
export function oklchToRgb(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const bb = c * Math.sin(h);

  const l_ = (l + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * bb) ** 3;

  return {
    r: encodeGamma(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    g: encodeGamma(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    b: encodeGamma(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  };
}

/** A number that may carry a `%`, as a 0–1 fraction when it does. */
function scalar(raw: string, percentBase = 1): number {
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return 0;
  return raw.trim().endsWith('%') ? (value / 100) * percentBase : value;
}

/**
 * Any CSS color this platform actually stores → RGB: hex, `oklch(…)`, `rgb(…)`.
 *
 * Returns null — NOT black — for anything else (`color-mix(…)`, a named color, a
 * `var()` reference). A caller that cannot resolve a color must be able to tell that
 * apart from a color that resolved to black, because the only safe thing to do with
 * an unresolvable color is decline to judge it.
 */
export function parseColor(input: string | null | undefined): Rgb | null {
  const value = (input ?? '').trim();
  if (!value) return null;

  if (normalizeHex(value)) return hexToRgb(value);

  const oklch = OKLCH_RE.exec(value);
  if (oklch) {
    return oklchToRgb(scalar(oklch[1]!), scalar(oklch[2]!, 0.4), Number.parseFloat(oklch[3]!) || 0);
  }

  const rgb = RGB_RE.exec(value);
  if (rgb) {
    return {
      r: clamp255(Number.parseFloat(rgb[1]!)),
      g: clamp255(Number.parseFloat(rgb[2]!)),
      b: clamp255(Number.parseFloat(rgb[3]!)),
    };
  }

  return null;
}

// sRGB channel (0–1) → linear-light value, per WCAG.
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an RGB triple (0 = black, 1 = white). */
export function luminanceOf({ r, g, b }: Rgb): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG relative luminance (0 = black, 1 = white). Accepts any format
 *  `parseColor` handles; unparseable input reads as black, as it always has. */
export function relativeLuminance(color: string): number {
  return luminanceOf(parseColor(color) ?? { r: 0, g: 0, b: 0 });
}

/** WCAG contrast ratio between two already-parsed colors (1 → 21). Symmetric. */
export function contrastOf(a: Rgb, b: Rgb): number {
  const la = luminanceOf(a);
  const lb = luminanceOf(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG contrast ratio between two colors (1 → 21). Symmetric. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Mix `amount` of `a` into `b` in OKLab — the operation behind silica's `soft`
 * treatment, `color-mix(in oklab, <accent> 15%, var(--color-base-100))`.
 *
 * Implemented on the OKLab axes rather than on sRGB because that is what the browser
 * does, and the two disagree visibly: mixing 15% of a saturated color into a light
 * surface in sRGB lands somewhere duller and lighter than the tint actually painted.
 * A contrast check that mixed in the wrong space would be judging a color nobody sees.
 */
export function mixOklab(a: Rgb, b: Rgb, amount: number): Rgb {
  const t = Math.max(0, Math.min(1, amount));
  const [la, aa, ba] = toOklab(a);
  const [lb, ab, bbv] = toOklab(b);
  return fromOklab(la * t + lb * (1 - t), aa * t + ab * (1 - t), ba * t + bbv * (1 - t));
}

function toOklab({ r, g, b }: Rgb): [number, number, number] {
  const lr = linearize(r);
  const lg = linearize(g);
  const lb = linearize(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab(L: number, A: number, B: number): Rgb {
  const l_ = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m_ = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s_ = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return {
    r: encodeGamma(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    g: encodeGamma(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    b: encodeGamma(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  };
}

/** The OKLCH lightness of a color, 0–1 — the value silica's auto-`-content`
 *  derivation compares against `--silica-content-threshold`. */
export function oklchLightness(color: Rgb): number {
  return toOklab(color)[0];
}

/**
 * The OKLCH lightness of a CSS color STRING — read straight off the value when it is
 * already OKLCH, and derived from sRGB otherwise.
 *
 * The distinction is not pedantry. silicaui's auto-foreground rule is
 * `oklch(from <color> …)`, which reads the ORIGINAL lightness; going through sRGB
 * instead moves it by up to ~0.02, and the rule is a threshold comparison, so a token
 * sitting on the threshold flips to the opposite ink. `oklch(68% 0.1 232)` is exactly
 * silicaui's 0.68 default: the browser takes black and gets 7.4:1, a round-trip reads
 * 0.6798 and takes white for 2.8:1 — so a perfectly legible color reports as
 * unreadable. Found by running the contrast check over silicaui's own presets.
 */
export function cssLightness(input: string | null | undefined): number | null {
  const value = (input ?? '').trim();
  if (!value) return null;
  const oklch = OKLCH_RE.exec(value);
  if (oklch) return scalar(oklch[1]!);
  const rgb = parseColor(value);
  return rgb ? oklchLightness(rgb) : null;
}

// The two inks `-content` derivation chooses between. Near-black (not pure
// #000) reads softer on light surfaces while still clearing AA.
export const CONTENT_LIGHT_INK = '#ffffff';
export const CONTENT_DARK_INK = '#0a0a0a';

/**
 * Auto-derive the `-content` color (text/icon) for a base surface: pick
 * whichever of near-white / near-black has the higher contrast. Deterministic,
 * server-safe, and always the more legible of the two — tenants can override
 * any `-content` slot explicitly (docs/33 §3.1, the full-parity escape hatch).
 */
export function deriveContent(
  base: string,
  lightInk: string = CONTENT_LIGHT_INK,
  darkInk: string = CONTENT_DARK_INK
): string {
  return contrastRatio(base, lightInk) >= contrastRatio(base, darkInk) ? lightInk : darkInk;
}

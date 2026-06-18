// Pure colour logic behind the themed swatch picker (color-swatch.tsx): resolving
// the tenant `--st-*` palette, mapping a control's class TOKEN to a paint colour,
// and grading WCAG contrast. No React — just the maths the UI renders.

import type { BuilderNode } from '@sparx/builder-schemas';
import { BACKGROUND_CONTROL, readColorOpacity } from './class-controls';

// Every `--st-*` the recipe + skin colours can reference. All are guaranteed to
// exist on `.bx-canvas` (the storefront recipe sheet renders off them), so a probe
// reads concrete colours we can both paint and run contrast maths on.
export const ST_VARS = [
  '--st-primary',
  '--st-primary-content',
  '--st-secondary',
  '--st-secondary-content',
  '--st-accent',
  '--st-accent-content',
  '--st-neutral',
  '--st-neutral-content',
  '--st-info',
  '--st-info-content',
  '--st-success',
  '--st-success-content',
  '--st-warning',
  '--st-warning-content',
  '--st-danger',
  '--st-danger-content',
  '--st-highlight',
  '--st-highlight-content',
  '--st-base-100',
  '--st-base-200',
  '--st-base-300',
  '--st-base-content',
  '--st-border',
] as const;

// Degraded palette when no canvas is mounted (e.g. a surface without a live
// preview) — the picker stays usable, just not theme-accurate.
export const FALLBACK: Record<string, string> = {
  primary: '#6366f1',
  'primary-content': '#ffffff',
  secondary: '#475569',
  'secondary-content': '#ffffff',
  accent: '#f97316',
  'accent-content': '#ffffff',
  neutral: '#1f2937',
  'neutral-content': '#f8fafc',
  info: '#0ea5e9',
  'info-content': '#ffffff',
  success: '#16a34a',
  'success-content': '#ffffff',
  warning: '#d97706',
  'warning-content': '#1b1b20',
  danger: '#dc2626',
  'danger-content': '#ffffff',
  highlight: '#db2777',
  'highlight-content': '#ffffff',
  'base-100': '#ffffff',
  'base-200': '#f4f4f6',
  'base-300': '#e6e6ec',
  'base-content': '#1b1b20',
};

// ── Token → colour ───────────────────────────────────────────────────────────
// A colour control's option carries a class TOKEN (`bg-primary`, `st-c-accent`,
// `text-primary-content`, `from-base-100`, `border-base-300`, …). Strip the utility
// prefix to the colour NAME, then map the name to its `--st-*` var (or a literal).
const TOKEN_PREFIXES = [
  'st-c-',
  'bg-',
  'text-',
  'border-',
  'ring-',
  'shadow-',
  'caret-',
  'accent-',
  'from-',
  'via-',
  'to-',
];

export function colorNameFromToken(token: string): string {
  for (const p of TOKEN_PREFIXES) if (token.startsWith(p)) return token.slice(p.length);
  return token;
}

/** The `--st-*` variable a colour name resolves to (null for literal black/white,
 *  or 'transparent' for the empty slot). `surface` is the page surface. */
function varNameFor(name: string): string | null {
  if (name === 'white' || name === 'black' || name === 'transparent') return null;
  if (name === 'surface') return 'base-100';
  return name;
}

/** A CSS paint expression for a colour name — `var(--st-primary, #6366f1)`, a
 *  literal, or null for the transparent/empty slot. */
export function paintExpr(name: string): string | null {
  if (name === 'transparent') return null;
  if (name === 'white') return '#ffffff';
  if (name === 'black') return '#000000';
  const v = varNameFor(name)!;
  return `var(--st-${v}, ${FALLBACK[v] ?? '#888888'})`;
}

/** The content/"on" colour for a recipe slot — the legible text over a solid fill. */
export function onPaintExpr(name: string): string {
  if (name === 'surface' || name === 'neutral') {
    return name === 'neutral'
      ? `var(--st-neutral-content, ${FALLBACK['neutral-content']})`
      : `var(--st-base-content, ${FALLBACK['base-content']})`;
  }
  const key = `${name}-content`;
  return `var(--st-${key}, ${FALLBACK[key] ?? '#ffffff'})`;
}

/** A legible backdrop for a TEXT-colour swatch: dark inks preview on the page
 *  surface; light inks (white / on-primary / a pale theme colour) preview on a
 *  dark tile, so the "Aa" sample never vanishes into a same-tone background. */
export function textSwatchBackdrop(name: string, vars: Record<string, string>): string {
  const fg = parseColor(concrete(name, vars));
  const page = parseColor(concrete('base-100', vars));
  if (!fg || !page) return 'var(--st-base-100, #ffffff)';
  return contrastRatio(fg, page) >= 1.8
    ? 'var(--st-base-100, #ffffff)'
    : 'var(--st-neutral, #1f2937)';
}

/** Resolve a colour name to a concrete colour string for contrast maths. */
function concrete(name: string, vars: Record<string, string>): string {
  if (name === 'white') return '#ffffff';
  if (name === 'black') return '#000000';
  const v = varNameFor(name);
  if (!v) return '#ffffff';
  return vars[`--st-${v}`] ?? FALLBACK[v] ?? '#888888';
}

// ── Contrast (WCAG) ───────────────────────────────────────────────────────────
interface RGB {
  r: number;
  g: number;
  b: number;
}

function parseColor(str: string): RGB | null {
  const s = str.trim();
  if (s.startsWith('#')) {
    let h = s.slice(1);
    if (h.length === 3)
      h = h
        .split('')
        .map((c) => c + c)
        .join('');
    if (h.length < 6) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  const m = s.match(/-?\d+(\.\d+)?/g);
  if (!m || m.length < 3) return null;
  return { r: Number(m[0]), g: Number(m[1]), b: Number(m[2]) };
}

const composite = (fg: RGB, a: number, bg: RGB): RGB => ({
  r: fg.r * a + bg.r * (1 - a),
  g: fg.g * a + bg.g * (1 - a),
  b: fg.b * a + bg.b * (1 - a),
});

function luminance({ r, g, b }: RGB): number {
  const f = (c: number): number => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(a: RGB, b: RGB): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export interface Verdict {
  tier: string;
  cls: 'pass' | 'aa' | 'fail';
  ratio: string;
}

/** Grade a text colour against the node's effective background (its own `bg-*` at
 *  the set opacity over the page, else the page surface). Both colours come from
 *  the resolved tenant palette, so the badge reflects THIS site. */
export function gradeContrast(
  textName: string,
  textOpacity: number,
  vars: Record<string, string>,
  node: BuilderNode,
  ctx: string
): Verdict | null {
  const page = parseColor(concrete('base-100', vars));
  if (!page) return null;
  const bgState = readColorOpacity(node.class, BACKGROUND_CONTROL, ctx);
  let bg = page;
  if (bgState.value) {
    const bgOpt = BACKGROUND_CONTROL.options.find((o) => o.value === bgState.value);
    const bgName = bgOpt ? colorNameFromToken(bgOpt.token) : null;
    if (bgName && bgName !== 'transparent') {
      const fill = parseColor(concrete(bgName, vars));
      if (fill) bg = composite(fill, bgState.opacity / 100, page);
    }
  }
  const text = parseColor(concrete(textName, vars));
  if (!text) return null;
  const eff = composite(text, textOpacity / 100, bg);
  const ratio = contrastRatio(eff, bg);
  const r = ratio.toFixed(1);
  if (ratio >= 7) return { tier: 'AAA', cls: 'pass', ratio: r };
  if (ratio >= 4.5) return { tier: 'AA', cls: 'aa', ratio: r };
  if (ratio >= 3) return { tier: 'AA Large', cls: 'aa', ratio: r };
  return { tier: 'Low', cls: 'fail', ratio: r };
}

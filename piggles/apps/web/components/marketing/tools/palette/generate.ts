import { hexToOklch, inGamut, oklchToHex } from '@wizeworks/silicaui-react';
import { seat } from './seat';
import { swatch, type Palette } from './model';

/**
 * Palettes, generated in OKLCH rather than HSL.
 *
 * HSL lightness is not perceived lightness: yellow at L 50 is far brighter than
 * blue at L 50, so a set built by nudging HSL comes out with the warm colors
 * shouting and the cool ones sunk. OKLCH is perceptually uniform — asking for
 * L 0.62 gives five colors that genuinely read as equally bright, which is what
 * makes a generated set look chosen rather than computed.
 */
export type Scheme = 'balanced' | 'complement' | 'analogous' | 'triad' | 'tetrad' | 'mono' | 'wild';

export const SCHEMES: Record<Scheme, { label: string; blurb: string }> = {
  balanced: {
    label: 'A working set',
    blurb: 'One color to lead, something to read on, and a paper to sit it all on.',
  },
  complement: {
    label: 'Opposites',
    blurb: 'Two sides of the wheel. Loud, and unbeatable when one thing must stand out.',
  },
  analogous: {
    label: 'Neighbours',
    blurb: 'Colors that already live together. Calm, and hard to get wrong.',
  },
  triad: { label: 'Three-way', blurb: 'Evenly spaced. Lively without any two of them arguing.' },
  tetrad: {
    label: 'Four-way',
    blurb: 'Two pairs of opposites. The most range, and the easiest to overdo.',
  },
  mono: {
    label: 'One color',
    blurb: 'A single hue at several strengths. The safest brand there is.',
  },
  wild: {
    label: 'Surprise me',
    blurb: 'Anything, kept inside the range a screen can actually show.',
  },
};

const OFFSETS: Record<Exclude<Scheme, 'wild'>, number[]> = {
  balanced: [0, 0, 180, 42, -38],
  complement: [0, 180],
  analogous: [0, 26, -26, 52, -52],
  triad: [0, 120, 240],
  tetrad: [0, 90, 180, 270],
  mono: [0],
};

/** Deterministic from the seed, so the same shuffle re-renders identically and a
 *  locked swatch never moves because a parent re-rendered. */
function rng(seed: number): () => number {
  let a = (seed * 1831565813) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Perceived lightness for each slot, always reaching both ends.
 *
 * Five mid-tones are technically a harmony and useless in practice: a page needs
 * something pale enough to sit behind text and something dark enough to be text.
 * The ladder guarantees both exist no matter which scheme is chosen.
 */
function ladder(n: number): number[] {
  if (n === 1) return [0.62];
  const top = 0.94;
  const bottom = 0.27;
  return Array.from({ length: n }, (_, i) => top - ((top - bottom) * i) / (n - 1));
}

/** Chroma falls off at both ends. Full chroma at L 0.94 is a highlighter; at
 *  L 0.27 it stops reading as a color and starts reading as ink. */
function chromaFor(l: number, base: number): number {
  const distance = Math.abs(l - 0.6) / 0.6;
  return base * (1 - distance) ** 0.5;
}

/** Pull chroma in until sRGB can show it. Without this, a vivid hue at a high
 *  lightness is silently clamped per channel and comes back a different hue. */
function fit(l: number, c: number, h: number): string {
  let chroma = Math.max(0, c);
  while (chroma > 0.012 && !inGamut(l, chroma, h)) chroma -= 0.006;
  return oklchToHex(l, chroma, h).toUpperCase();
}

/** Shuffle the ladder so the pale one is not always first, while keeping the set
 *  intact. Order is a look; the contents are the system. */
function shuffled<T>(list: T[], next: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * The ladder steps still available once the locked colors have taken theirs.
 *
 * A locked swatch already occupies a rung, so the rung nearest its own lightness
 * comes out of the pool. Handing rungs out by SLOT INDEX instead — which is what
 * this did first — spends them on colors that are not going to be generated:
 * lock a mid blue and a dark navy, shuffle, and both remaining swatches came back
 * dark because the pale rungs had been assigned to the two locked slots and
 * thrown away. The palette had no paper in it at all.
 */
function available(palette: Palette, next: () => number): number[] {
  const pool = ladder(palette.length);

  for (const swatch of palette) {
    if (!swatch.locked) continue;
    const l = hexToOklch(swatch.hex)?.l;
    if (l === undefined) continue;
    let nearest = 0;
    for (let i = 1; i < pool.length; i++) {
      if (Math.abs(pool[i]! - l) < Math.abs(pool[nearest]! - l)) nearest = i;
    }
    pool.splice(nearest, 1);
  }

  return shuffled(pool, next);
}

/**
 * Re-roll every unlocked swatch.
 *
 * Locked ones are the brief: their hue anchors the scheme and their lightness is
 * taken out of the ladder, so locking a brand color and shuffling gives a set
 * built around it rather than a set that happens to contain it.
 */
function reroll(palette: Palette, scheme: Scheme, seed: number): Palette {
  const next = rng(seed);
  const anchor = palette.find((s) => s.locked);
  const rootHue = anchor ? (hexToOklch(anchor.hex)?.h ?? next() * 360) : next() * 360;
  const baseChroma = 0.11 + next() * 0.08;

  const slots = available(palette, next);
  const offsets = scheme === 'wild' ? null : OFFSETS[scheme];
  let taken = 0;

  /**
   * Which member of the harmony each slot takes, rotated per shuffle.
   *
   * Reading the offsets straight off the slot index makes the whole result a
   * function of what is locked: with two colors pinned, two consecutive
   * shuffles came back `#904D05` and `#8F4F10` — a different palette by the
   * letter and the same one to look at. Rotating the assignment keeps the
   * harmony exactly as valid and gives the button something to actually do.
   */
  const spin = Math.floor(next() * 5);

  /**
   * How many of the free rungs may become near-neutral tints.
   *
   * A working set wants a paper and an ink, but never at the cost of having no
   * color left. With two colors locked there are only two rungs to fill, and
   * spending both on tints of the locked hue produced a palette of four blues
   * that barely moved when you pressed shuffle again — the one thing a shuffle
   * button must never do. Below four free rungs it claims the pale end only.
   */
  const free = palette.filter((s) => !s.locked).length;
  const budget = scheme !== 'balanced' ? 0 : free >= 4 ? 2 : free >= 2 ? 1 : 0;
  const tints = new Set<number>();
  if (budget >= 1) tints.add(Math.max(...slots));
  if (budget >= 2) tints.add(Math.min(...slots));

  return palette.map((current, i) => {
    if (current.locked) return current;

    const rung = slots[taken++] ?? 0.6;
    const l = Math.min(0.97, Math.max(0.2, rung + (next() - 0.5) * 0.04));
    const neutral = tints.has(rung);

    const hue = neutral
      ? rootHue
      : offsets === null
        ? (rootHue + i * 137.508 + next() * 24) % 360
        : (rootHue + offsets[(i + spin) % offsets.length]! + (next() - 0.5) * 14 + 360) % 360;

    // The paper and the ink of a working set are TINTS of the brand hue, not two
    // more colors. Giving them full chroma is what produced three browns and a
    // blue and called it a brand — real palettes carry one or two colors and a
    // pair of near-neutrals that quietly belong to them.
    const c = chromaFor(l, baseChroma * (scheme === 'mono' ? 0.5 + next() : 0.85 + next() * 0.4));

    return { ...current, hex: fit(l, neutral ? c * 0.22 : c, hue) };
  });
}

export function generate(palette: Palette, scheme: Scheme, seed: number): Palette {
  return seat(reroll(palette, scheme, seed));
}

/** One more color, related to what is already there rather than random. */
export function grow(palette: Palette, seed: number): Palette {
  const next = rng(seed);
  const source = palette[Math.floor(next() * palette.length)]!;
  const oklch = hexToOklch(source.hex);
  if (!oklch) return [...palette, swatch('#8A8A8A')];

  const l = Math.min(0.95, Math.max(0.22, oklch.l + (next() - 0.5) * 0.5));
  return [
    ...palette,
    swatch(fit(l, chromaFor(l, oklch.c || 0.12), (oklch.h + 150 + next() * 60) % 360)),
  ];
}

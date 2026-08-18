import * as React from 'react';
import {
  buildHarmony,
  hexToHsl,
  hslToHex,
  HARMONY_HUE_OFFSETS,
  HARMONY_MONO_LIGHTNESS,
  type HarmonyKind,
  type PaletteColor,
} from './lib/color';

/**
 * Stateful palette engine for the brand color tool — the Coolors-style loop.
 *
 * A palette is an ordered list of slots: slot 0 is the primary, the rest are
 * accents. Each slot carries a `locked` flag. The two ways colors change:
 *
 *  - Clean derive: changing the primary, the harmony scheme, or the accent count
 *    re-derives every UNLOCKED accent from the primary using exact color-wheel
 *    offsets (deterministic, no randomness).
 *  - Shuffle: re-rolls every UNLOCKED slot with a jittered variation — the
 *    primary becomes a fresh vivid color (if unlocked) and accents stay within
 *    their scheme's offset but wander in hue/saturation/lightness. Locked slots
 *    never move, so you can keep the colors you like and re-roll the rest.
 *
 * Initial state is fully deterministic (no Math.random) so SSR and the first
 * client render match; randomness only enters on a user-triggered shuffle.
 */
interface Slot {
  hex: string;
  locked: boolean;
}

const INITIAL_BASE = '#6366F1';
const INITIAL_HARMONY: HarmonyKind = 'complementary';
const INITIAL_ACCENTS = 2;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** A vivid brand color that is neither washed out nor near-black. */
function randomPrimary(): string {
  return hslToHex({ h: rand(0, 360), s: rand(0.55, 0.85), l: rand(0.46, 0.6) });
}

/** A free-form vivid color, unconstrained by the primary — Random mode. */
function randomVivid(): string {
  return hslToHex({ h: rand(0, 360), s: rand(0.5, 0.85), l: rand(0.4, 0.66) });
}

/** Clean accents for a derive: deterministic for schemes, free-form for Random. */
function deriveAccents(primaryHex: string, kind: HarmonyKind, count: number): string[] {
  if (kind === 'random') return Array.from({ length: count }, () => randomVivid());
  return buildHarmony(primaryHex, kind, count);
}

/** A jittered accent for `index`, anchored to `primaryHex` within `kind`. */
function shuffleAccent(primaryHex: string, kind: HarmonyKind, index: number): string {
  if (kind === 'random') return randomVivid();
  const hsl = hexToHsl(primaryHex);
  if (!hsl) return primaryHex;
  if (kind === 'monochromatic') {
    const base = HARMONY_MONO_LIGHTNESS[index % HARMONY_MONO_LIGHTNESS.length] ?? 0;
    return hslToHex({
      h: hsl.h,
      s: clamp(hsl.s + rand(-0.12, 0.12), 0.2, 0.95),
      l: clamp(hsl.l + base + rand(-0.08, 0.08), 0.16, 0.88),
    });
  }
  const offsets = HARMONY_HUE_OFFSETS[kind];
  const offset = offsets[index % offsets.length] ?? 180;
  return hslToHex({
    h: (hsl.h + offset + rand(-16, 16) + 360) % 360,
    s: clamp(hsl.s + rand(-0.16, 0.12), 0.35, 0.95),
    l: clamp(hsl.l + rand(-0.12, 0.12), 0.34, 0.7),
  });
}

function roleFor(index: number, accentCount: number): string {
  if (index === 0) return 'Primary';
  return accentCount === 1 ? 'Accent' : `Accent ${index}`;
}

/** Re-derive unlocked accents (slot 0 and locked slots untouched). */
function rederive(slots: Slot[], primaryHex: string, kind: HarmonyKind): Slot[] {
  const accents = deriveAccents(primaryHex, kind, slots.length - 1);
  return slots.map((s, i) => (i === 0 || s.locked ? s : { ...s, hex: accents[i - 1] ?? s.hex }));
}

export interface PaletteApi {
  colors: PaletteColor[];
  locked: boolean[];
  harmony: HarmonyKind;
  accentCount: number;
  prefix: string;
  selected: number;
  primaryHex: string;
  setPrimary: (hex: string) => void;
  setHarmony: (kind: HarmonyKind) => void;
  setAccentCount: (n: number) => void;
  setPrefix: (v: string) => void;
  setSelected: (i: number) => void;
  toggleLock: (i: number) => void;
  shuffle: () => void;
}

export function usePalette(): PaletteApi {
  const [slots, setSlots] = React.useState<Slot[]>(() => [
    { hex: INITIAL_BASE, locked: true },
    ...deriveAccents(INITIAL_BASE, INITIAL_HARMONY, INITIAL_ACCENTS).map((hex) => ({
      hex,
      locked: false,
    })),
  ]);
  const [harmony, setHarmonyState] = React.useState<HarmonyKind>(INITIAL_HARMONY);
  const [prefix, setPrefix] = React.useState('brand');
  const [selected, setSelected] = React.useState(0);

  const setPrimary = React.useCallback(
    (hex: string) => {
      setSlots((prev) => {
        const next = prev.map((s) => ({ ...s }));
        next[0] = { ...next[0]!, hex };
        // Random accents are independent of the primary, so leave them be.
        return harmony === 'random' ? next : rederive(next, hex, harmony);
      });
    },
    [harmony]
  );

  const setHarmony = React.useCallback((kind: HarmonyKind) => {
    setHarmonyState(kind);
    setSlots((prev) => rederive(prev, prev[0]!.hex, kind));
  }, []);

  const setAccentCount = React.useCallback(
    (n: number) => {
      const total = Math.min(4, Math.max(1, Math.round(n))) + 1;
      setSlots((prev) => {
        if (total === prev.length) return prev;
        if (total < prev.length) return prev.slice(0, total);
        const next = prev.map((s) => ({ ...s }));
        const accents = deriveAccents(next[0]!.hex, harmony, total - 1);
        while (next.length < total) {
          next.push({ hex: accents[next.length - 1] ?? next[0]!.hex, locked: false });
        }
        return next;
      });
    },
    [harmony]
  );

  const toggleLock = React.useCallback((i: number) => {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, locked: !s.locked } : s)));
  }, []);

  const shuffle = React.useCallback(() => {
    setSlots((prev) => {
      const next = prev.map((s) => ({ ...s }));
      if (!next[0]!.locked) next[0] = { ...next[0]!, hex: randomPrimary() };
      const primaryHex = next[0]!.hex;
      next.forEach((s, i) => {
        if (i >= 1 && !s.locked) next[i] = { ...s, hex: shuffleAccent(primaryHex, harmony, i - 1) };
      });
      return next;
    });
  }, [harmony]);

  const accentCount = slots.length - 1;
  const colors: PaletteColor[] = slots.map((s, i) => ({
    role: roleFor(i, accentCount),
    hex: s.hex.toUpperCase(),
  }));

  return {
    colors,
    locked: slots.map((s) => s.locked),
    harmony,
    accentCount,
    prefix,
    selected: Math.min(selected, slots.length - 1),
    primaryHex: slots[0]!.hex,
    setPrimary,
    setHarmony,
    setAccentCount,
    setPrefix,
    setSelected,
    toggleLock,
    shuffle,
  };
}

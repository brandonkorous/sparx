import { parseHex, toHex, type Rgb } from '../lib/color';

/** A palette is an ordered list of these. `id` is stable across reorders and
 *  shuffles so a dragged column keeps its DOM node and its pointer capture. */
export interface Swatch {
    id: string;
    hex: string;
    locked: boolean;
}

export type Palette = Swatch[];

/** Five, because position is the role and there are exactly five roles. Anything
 *  shorter leaves one with no color in it, and every way of covering that puts
 *  a value nobody chose into the theme. Slots six to eight are spares with no
 *  job. See `ROLE_ORDER`. */
export const MIN_SWATCHES = 5;
export const MAX_SWATCHES = 8;

/** Ids are a plain counter, never `Date.now()` or `Math.random()`. The first
 *  render happens on the server and again on the client, and anything clock- or
 *  entropy-derived differs between the two — which React reports as a hydration
 *  mismatch and repairs by throwing the client tree away. */
let counter = 0;
export const newId = (): string => `sw${counter++}`;

export const swatch = (hex: string, locked = false): Swatch => ({
    id: newId(),
    hex: hex.toUpperCase(),
    locked,
});

/** The palette a first-time visitor lands on, IN SLOT ORDER — the Piggles pink
 *  as `primary`, two app-group hues, a paper, and the charcoal as `neutral`. A
 *  real system rather than five mid-tones, because the first thing anybody sees
 *  should be the thing the tool is trying to teach. */
export const STARTER = ['#FF6F86', '#F3B61F', '#4D7C0F', '#FFF1F3', '#2D3443'];

export const startingPalette = (): Palette => STARTER.map((hex) => swatch(hex));

/**
 * The palette, in a URL.
 *
 * Case carries the lock: `FF6F86` is locked, `ff6f86` is not. Hex is
 * case-insensitive so it round-trips exactly, and it keeps the link to one
 * short parameter instead of two that can disagree with each other.
 */
export function encode(palette: Palette): string {
    return palette
        .map((s) => {
            const bare = s.hex.replace('#', '');
            return s.locked ? bare.toUpperCase() : bare.toLowerCase();
        })
        .join('-');
}

export function decode(value: string | null): Palette | null {
    if (!value) return null;
    const parts = value.split('-').filter(Boolean);
    if (parts.length < MIN_SWATCHES || parts.length > MAX_SWATCHES) return null;

    const out: Palette = [];
    for (const part of parts) {
        const rgb = parseHex(part);
        if (!rgb) return null;
        out.push(swatch(toHex(rgb), part === part.toUpperCase()));
    }
    return out;
}

export const rgbOf = (s: Swatch): Rgb => parseHex(s.hex) ?? { r: 0, g: 0, b: 0 };

/** Reorder without mutating. Returns the same array when nothing moves, so a
 *  drag that hovers its own slot does not re-render the stage on every frame. */
export function move<T>(list: T[], from: number, to: number): T[] {
    if (from === to || to < 0 || to >= list.length) return list;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    return next;
}

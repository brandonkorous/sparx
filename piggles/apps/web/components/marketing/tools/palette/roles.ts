import { contrastRatio, parseHex, readableInk, toHex, type Rgb } from '../lib/color';
import { rgbOf, type Palette } from './model';

/**
 * Which colour does which job — decided by WHERE IT SITS.
 *
 * ── POSITION IS THE ASSIGNMENT ──────────────────────────────────────────────
 *
 * The roles are fixed to the slots and the colours move through them, so
 * dragging a swatch into the second position makes it the page background. One
 * mechanism does both jobs: there is no second control for assignment, no hidden
 * state, and nothing to explain beyond "drag it where you want it".
 *
 * What this replaced was a legend of chips you clicked to cycle a role onto a
 * different swatch. It worked, and it was a second way to do a thing the stage
 * could already almost do — two mechanisms for one idea.
 *
 * ── AND THE NAMES ARE SILICA'S ──────────────────────────────────────────────
 *
 * A slot is called `primary` on the column and `--color-primary` in every
 * export. It was "Buttons" on screen and `--brand` in the CSS, which left the
 * reasonable question "where is brand defined?" with no answer on the page.
 *
 * `info` / `success` / `warning` / `error` have no slot. They mean something
 * fixed — went well, needs attention, about to be deleted — and a green pulled
 * out of somebody's brand palette landing on `error` would be worse than
 * leaving silica's own.
 */
export type Role = 'primary' | 'base-100' | 'accent' | 'secondary' | 'neutral';

/**
 * The slots, in order: the three colours, the page they sit on, then the chrome.
 *
 * ── THERE ARE FIVE, SO THE PALETTE IS FIVE ──────────────────────────────────
 *
 * This list IS `MIN_SWATCHES`. A shorter palette leaves a role with no colour in
 * it, and the only ways to handle that are to invent a value or to borrow one —
 * both of which put a colour nobody chose into the exported theme, reported as
 * though it had been chosen. Five roles, five slots, and anything past the fifth
 * is a spare with no job.
 *
 * ── AND EVERY SLOT IS A COLOUR; NO SLOT IS AN INK ───────────────────────────
 *
 * `base-content` used to sit in here holding a dark charcoal. That was wrong
 * twice: the ink on the page is not a member of the palette, and the colour
 * standing in that slot was plainly doing `neutral`'s job — silica's own
 * `neutral` (L 26%) and `base-content` (L 21%) are near-identical for exactly
 * that reason. It lives in the band under `base-100` now, which made the band
 * uniform: every slot has a colour above and its ink below.
 */
export const ROLE_ORDER: Role[] = ['primary', 'secondary', 'accent', 'base-100', 'neutral'];

/** What each silica role is for, in words a shop owner can act on. The name is
 *  the truth; this is the translation. */
export const ROLE_JOBS: Record<Role, string> = {
  primary: 'Buttons and links',
  'base-100': 'The page behind everything',
  accent: 'Highlights and tags',
  secondary: 'The supporting one',
  neutral: 'Edges and quiet chrome',
};

/** The role a given slot carries, or null for a spare beyond the six. */
export const roleAt = (index: number): Role | null => ROLE_ORDER[index] ?? null;

/**
 * Inks the visitor has overridden, keyed by role.
 *
 * Silica derives every `-content` by measured contrast, which is the right
 * DEFAULT and not always the right answer — black clears the maths on a mid
 * pink and a brand may still want white on it. Anything in here is a decision
 * somebody made, so it is also the only thing the exported theme declares.
 */
export type ContentInk = Partial<Record<Role, string>>;

/** Every slot has an ink, and every one of them is overridable. The band has no
 *  read-only cell and no gap. */
export const INK_ROLES: Role[] = ROLE_ORDER;

/** The token a slot's ink is called. `base-100`'s is `base-content` — silica's
 *  own name for it, and not `base-100-content`. */
export const inkName = (role: Role): string =>
  role === 'base-100' ? 'base-content' : `${role}-content`;

export interface Assignment {
  'base-100': string;
  'base-content': string;
  primary: string;
  primaryContent: string;
  secondary: string;
  secondaryContent: string;
  accent: string;
  accentContent: string;
  neutral: string;
  neutralContent: string;
  /** Hairlines and dividers — `neutral` walked back towards the page. */
  line: string;
  /** Second-rank text. Still measured against the surface, never a faded ink. */
  quiet: string;
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
});

/** Ink has to be readable, not merely dark. Drop two pale colours into slots two
 *  and three and nothing in the palette clears 4.5:1, so the writing is darkened
 *  until it does — and the column says so rather than quietly exporting a value
 *  that is not the swatch above it. */
export function forceReadable(candidate: Rgb, surface: Rgb): Rgb {
  if (contrastRatio(candidate, surface) >= 4.5) return candidate;
  const target = readableInk(surface);
  for (let t = 0.1; t <= 1.0001; t += 0.1) {
    const mixed = mix(candidate, target, t);
    if (contrastRatio(mixed, surface) >= 4.6) return mixed;
  }
  return target;
}

export function assign(palette: Palette, chosen: ContentInk = {}): Assignment {
  const rgbs = palette.map(rgbOf);
  // Every role has a slot: the palette cannot be shorter than `ROLE_ORDER`.
  // There is deliberately no borrowing here — a stand-in is a colour nobody
  // chose, exported as though somebody had.
  const at = (role: Role): Rgb => rgbs[ROLE_ORDER.indexOf(role)]!;

  const surface = at('base-100');
  const neutral = at('neutral');

  const ink = (role: Role): string => {
    if (chosen[role]) return chosen[role];
    // The page's ink is the neutral, forced dark enough to read on it. Every
    // other slot takes the black-or-white silica would have measured.
    if (role === 'base-100') return toHex(forceReadable(neutral, surface));
    return toHex(readableInk(at(role)));
  };

  const content = ink('base-100');

  return {
    'base-100': toHex(surface),
    'base-content': content,
    primary: toHex(at('primary')),
    primaryContent: ink('primary'),
    secondary: toHex(at('secondary')),
    secondaryContent: ink('secondary'),
    accent: toHex(at('accent')),
    accentContent: ink('accent'),
    neutral: toHex(neutral),
    neutralContent: ink('neutral'),
    line: toHex(mix(surface, neutral, 0.3)),
    quiet: toHex(forceReadable(mix(surface, parseOr(content), 0.72), surface)),
  };
}

/**
 * The ink that goes on a slot, and what it is called.
 *
 * Shown under the colour it goes ON, because a fill and its foreground are one
 * decision and looking at either alone tells you nothing. Every slot has one —
 * `base-100`'s is simply called `base-content`.
 */
export function contentFor(role: Role, roles: Assignment): { name: string; hex: string } {
  const hex =
    role === 'base-100'
      ? roles['base-content']
      : role === 'primary'
        ? roles.primaryContent
        : role === 'secondary'
          ? roles.secondaryContent
          : role === 'accent'
            ? roles.accentContent
            : roles.neutralContent;

  return { name: inkName(role), hex };
}

export const parseOr = (hex: string): Rgb => parseHex(hex) ?? { r: 0, g: 0, b: 0 };

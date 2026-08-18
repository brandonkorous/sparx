// The theme vocabulary, in the words a business owner uses.
//
// silica names a token for the developer who reads the CSS (`--color-base-200`,
// `--radius-selector`). Everything here is the other half of that mapping: what
// the token is called on screen, what it actually changes, and which literal
// Tailwind classes paint a sample of it.
//
// The class strings must stay LITERAL. Tailwind reads source text, so a class
// assembled at runtime (`bg-${role}`) is never generated and the swatch renders
// with no fill at all — the silent failure this table exists to prevent.

import { SURFACE_TOKENS } from '@wizeworks/silicaui-html';

export interface ColorRole {
  /** The CSS custom property the theme stores. */
  token: string;
  label: string;
  /** What this color actually turns up on, so the choice can be made on purpose. */
  hint: string;
  /** Literal classes that paint a live sample: the fill and its legible ink. */
  sample: string;
  /**
   * The words that sit ON this color, when it has its own.
   *
   * silica derives one by measured contrast if the theme leaves it unset, and
   * that derivation is a RECOMMENDATION rather than a rule — an author who wants
   * cream on their green can have it. Absent on the surface tokens, which all
   * share `--color-base-content` and edit it as its own row.
   */
  contentToken?: string;
}

export interface ColorGroup {
  label: string;
  hint: string;
  roles: ColorRole[];
}

/**
 * Every color a theme declares, grouped in the order someone thinks about them:
 * the colors that are THEIRS, then the paper and ink, then the ones that carry a
 * meaning nobody chooses, then the leftover.
 */
export const COLOR_GROUPS: ColorGroup[] = [
  {
    label: 'Your colors',
    hint: 'What people will recognize as yours.',
    roles: [
      {
        token: '--color-primary',
        label: 'Main color',
        hint: 'Buttons, links, the thing you want clicked.',
        sample: 'bg-primary text-primary-content',
        contentToken: '--color-primary-content',
      },
      {
        token: '--color-secondary',
        label: 'Second color',
        hint: 'The supporting action next to the main one.',
        sample: 'bg-secondary text-secondary-content',
        contentToken: '--color-secondary-content',
      },
      {
        token: '--color-accent',
        label: 'Highlight',
        hint: 'Used sparingly, to make one thing jump.',
        sample: 'bg-accent text-accent-content',
        contentToken: '--color-accent-content',
      },
    ],
  },
  {
    label: 'Paper and ink',
    // Three layers, nearest FIRST. silica paints the themed surface `base-100`
    // and Card uses it too, so 100 is what you look at and 200/300 sit behind it.
    hint: 'The layers your site is built from, nearest first — and the words on them.',
    roles: [
      {
        token: '--color-base-100',
        label: 'Main surface',
        hint: 'The highest layer — the page and the cards on it.',
        sample: 'bg-base-100 text-base-content',
      },
      {
        token: '--color-base-200',
        label: 'Second layer',
        hint: 'Behind the main surface — sunken panels and shading.',
        sample: 'bg-base-200 text-base-content',
      },
      {
        token: '--color-base-300',
        label: 'Background',
        hint: 'The deepest layer, furthest behind everything.',
        sample: 'bg-base-300 text-base-content',
      },
      {
        token: '--color-base-content',
        label: 'Text',
        hint: 'Every word that is meant to be read, on all three layers.',
        sample: 'bg-base-100 text-base-content',
      },
    ],
  },
  {
    label: 'What things mean',
    hint: 'Confirmations, warnings and problems. People read these by color before they read the words.',
    roles: [
      {
        token: '--color-info',
        label: 'Information',
        hint: 'Something worth knowing, nothing to do.',
        sample: 'bg-info text-info-content',
        contentToken: '--color-info-content',
      },
      {
        token: '--color-success',
        label: 'Went through',
        hint: 'Paid, sent, saved, in stock.',
        sample: 'bg-success text-success-content',
        contentToken: '--color-success-content',
      },
      {
        token: '--color-warning',
        label: 'Needs a look',
        hint: 'Running low, waiting on you, nearly due.',
        sample: 'bg-warning text-warning-content',
        contentToken: '--color-warning-content',
      },
      {
        token: '--color-error',
        label: 'Went wrong',
        hint: 'Declined, failed, out of stock.',
        sample: 'bg-error text-error-content',
        contentToken: '--color-error-content',
      },
    ],
  },
  {
    label: 'Everything else',
    hint: 'A quiet color for things that are simply there.',
    roles: [
      {
        token: '--color-neutral',
        label: 'Neutral',
        hint: 'Chrome and furniture that carries no meaning.',
        sample: 'bg-neutral text-neutral-content',
        contentToken: '--color-neutral-content',
      },
    ],
  },
];

/**
 * The sample classes for a color that was INVENTED — added here, or arrived with
 * an imported look.
 *
 * Assembled at runtime, which is exactly what the header above forbids for the
 * built-ins, and correct here for the same reason: `buildCustomColorCss` generates
 * `.bg-<name>` and `.text-<name>-content` at runtime as well, so nothing is asking
 * Tailwind to have seen a string it never could have. Reaching for the neutral
 * fallback instead is what left an added color showing as a grey chip.
 */
export function customRoleSample(role: string): string {
  return `bg-${role} text-${role}-content`;
}

const KNOWN_TOKENS = new Set(COLOR_GROUPS.flatMap((group) => group.roles.map((r) => r.token)));

/** True for a `--color-<role>` this file does not name — see `UNKNOWN_ROLE_SAMPLE`. */
export function isKnownColorToken(token: string): boolean {
  return KNOWN_TOKENS.has(token);
}

/** `--color-primary` → `primary`. Surfaces included; `-content` foregrounds are
 *  not roles and never reach here. */
export function roleOf(token: string): string {
  return token.replace(/^--color-/, '');
}

/** Is this token one of silica's four surface tokens rather than a semantic role?
 *  Surfaces are measured against the ink; roles derive their own. */
export function isSurfaceToken(token: string): boolean {
  return SURFACE_TOKENS.some((surface) => `--color-${surface}` === token);
}

/** A stable coalesce key, so one continuous edit to one token is one undo step. */
export function coalesceKey(mode: string, token: string): string {
  return `theme.setToken:${mode}:${token}`;
}

/** What each scalar group is called on screen, and what changing it does. */
export const SCALAR_GROUPS: { group: string; label: string; hint: string }[] = [
  {
    group: 'radius',
    label: 'Corners',
    hint: 'How round everything is — square and formal, or soft and friendly.',
  },
  {
    group: 'form',
    label: 'Outlines and size',
    hint: 'How heavy the lines are, and how much room controls take up.',
  },
  {
    group: 'effects',
    label: 'Depth and focus',
    hint: 'Whether things lift off the page, and how the keyboard outline looks.',
  },
  {
    group: 'motion',
    label: 'Movement',
    hint: 'How quickly things respond when they are touched.',
  },
];

/** Plainer names for the scalar tokens silica labels for developers. */
export const SCALAR_LABELS: Record<string, string> = {
  '--radius-box': 'Cards and panels',
  '--radius-field': 'Buttons and boxes',
  '--radius-selector': 'Checkboxes and switches',
  '--border': 'Line thickness',
  '--size-field': 'Button and box height',
  '--size-selector': 'Checkbox size',
  '--depth': 'Lift off the page',
  '--noise': 'Paper texture',
  '--focus-width': 'Keyboard outline',
  '--focus-offset': 'Outline gap',
  '--duration': 'Speed',
  '--ease': 'Feel',
};

/** The radius token each corner control edits, with the literal class that draws
 *  its shape. Reading the same token the control writes is the point: the sample
 *  is not an illustration of the value, it IS the value. */
export const RADIUS_SAMPLES: Record<string, string> = {
  '--radius-box': 'rounded-box',
  '--radius-field': 'rounded-field',
  '--radius-selector': 'rounded-selector',
};

/**
 * What each scalar token does, for the person paying for the site.
 *
 * silica's own `doc` string is written for the developer reading the CSS ("base
 * unit fields scale their height/padding from"), which is the right audience for
 * that file and the wrong one for this pane.
 */
export const SCALAR_HINTS: Record<string, string> = {
  '--radius-box': 'Cards, panels and pop-ups.',
  '--radius-field': 'Buttons, dropdowns, and boxes people type in.',
  '--radius-selector': 'Checkboxes, switches and radio buttons.',
  '--border': 'How heavy the lines around cards and boxes are.',
  '--size-field': 'Taller buttons and text boxes, everywhere at once.',
  '--size-selector': 'Bigger checkboxes and switches, everywhere at once.',
  '--depth': 'Cards cast a soft shadow and lift when pointed at. Off is completely flat.',
  '--noise': 'A very fine grain across the page, like printed paper.',
  '--focus-width':
    'The outline that appears when someone moves around with the keyboard. At nothing, your site cannot be used without a mouse.',
  '--focus-offset': 'How far that outline sits from the edge of the button.',
  '--duration': 'How long things take to change when they are pointed at or opened.',
  '--ease': 'Whether movement feels mechanical or springy.',
};

/**
 * The corner ladder — each step drawn on ONE corner of a square.
 *
 * One corner, not four, because four saturate: CSS scales radii so the two on a
 * side cannot overlap, so on a 32px chip anything past 16px is the same circle
 * and "Rounded", "Very round" and "Pill" become one picture under three names.
 * A lone corner has no neighbour to compete with, so it can grow to the full side
 * and every step stays a different shape.
 */
export const CORNER_STEPS: { value: string; label: string; shape: string }[] = [
  { value: '0rem', label: 'Square', shape: 'rounded-tl-none' },
  { value: '0.125rem', label: 'Barely', shape: 'rounded-tl-sm' },
  { value: '0.25rem', label: 'Soft', shape: 'rounded-tl' },
  { value: '0.5rem', label: 'Rounded', shape: 'rounded-tl-lg' },
  { value: '1rem', label: 'Very round', shape: 'rounded-tl-2xl' },
  { value: '2rem', label: 'Fully round', shape: 'rounded-tl-full' },
];

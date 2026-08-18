// Whether the words on a color can actually be read.
//
// silica RECOMMENDS each role's ink by measured contrast when the theme leaves it
// unset, but an author may write their own — cream on green rather than white on
// green — so the reading has to measure whatever ink is really in force, not the
// one silica would have picked. Reporting the recommendation while the theme uses
// something else would be a number that describes nothing on the page.
//
// Surfacing this at the moment of choosing is the difference between a theme
// editor and a color picker: a mid-tone, high-chroma color has no legible ink at
// all, and the author needs to know while they are dragging rather than after a
// customer cannot read the button.

import { AA_NORMAL, contrastRatio, deriveContent, parseColor } from '@wizeworks/silicaui-html';
import { isSurfaceToken } from './tokens';

export interface ContrastReading {
  /** Measured WCAG ratio, 1–21. */
  ratio: number;
  /** Clears AA for body text. */
  passes: boolean;
  /** True when the ink came from the theme rather than from silica's derivation. */
  authored: boolean;
  /** What to do about it, in plain words. Present only when it fails. */
  advice?: string;
}

/**
 * The reading for one token, or nothing when there is nothing to measure —
 * a value still being typed, or a `color-mix()` no measurement can parse.
 *
 * Surfaces are measured against the theme's ink, because that is the pair a
 * visitor actually reads. A role is measured against its own `-content` when the
 * theme sets one, and against silica's derivation when it does not.
 */
export function readContrast(
  token: string,
  value: string | undefined,
  values: Record<string, string>,
  contentToken?: string
): ContrastReading | undefined {
  if (!value) return undefined;

  if (token === '--color-base-content') {
    return againstSurface(values['--color-base-100'], value, true);
  }

  if (isSurfaceToken(token)) {
    return againstSurface(value, values['--color-base-content'], true);
  }

  const authoredInk = contentToken ? values[contentToken] : undefined;
  if (authoredInk) {
    const reading = againstSurface(value, authoredInk, true);
    return reading ? { ...reading, advice: reading.passes ? undefined : inkAdvice } : undefined;
  }

  const derived = deriveContent(value);
  if (!derived) return undefined;
  return {
    ratio: derived.ratio,
    passes: derived.passesAA,
    authored: false,
    advice: derived.passesAA
      ? undefined
      : 'Neither black nor white text reads clearly on this. Try it darker or lighter, or set the text color yourself.',
  };
}

const inkAdvice =
  'These two are too close to read comfortably. Move one of them further from the other.';

/** A background and the ink that will sit on it — both have to parse before there
 *  is anything to say. */
function againstSurface(
  background: string | undefined,
  ink: string | undefined,
  authored: boolean
): ContrastReading | undefined {
  const back = background ? parseColor(background) : undefined;
  const fore = ink ? parseColor(ink) : undefined;
  if (!back || !fore) return undefined;
  const ratio = contrastRatio(back, fore);
  return {
    ratio,
    passes: ratio >= AA_NORMAL,
    authored,
    advice: ratio >= AA_NORMAL ? undefined : inkAdvice,
  };
}

/** silica's recommended ink for a color — what the site uses when the theme sets
 *  none, and what the picker should open on so a first nudge starts from it. */
export function recommendedInk(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return deriveContent(value)?.value;
}

/** `4.87` → `4.9:1`, which is the only precision anyone reads. */
export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(1)}:1`;
}

export { AA_NORMAL };

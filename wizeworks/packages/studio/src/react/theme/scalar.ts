// The non-color tokens, as a list a control can iterate.
//
// silica declares `SCALAR_TOKENS` as a tuple of literal types — precise for a
// lookup, unusable for a list, because no two members share a type. This is the
// one cast, plus the number/string conversion every control would otherwise
// repeat.

import { SCALAR_TOKENS } from '@wizeworks/silicaui-html';

export interface ScalarToken {
  key: string;
  label: string;
  group: string;
  default: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  doc: string;
  options?: readonly { label: string; value: string }[];
}

export const SCALARS = SCALAR_TOKENS as readonly ScalarToken[];

export function scalarsIn(group: string): ScalarToken[] {
  return SCALARS.filter((token) => token.group === group);
}

export function scalarByKey(key: string): ScalarToken | undefined {
  return SCALARS.find((token) => token.key === key);
}

/** A stored `"0.5rem"` as the number a slider moves. Falls back to the token's own
 *  default, which is what the component would render anyway. */
export function scalarNumber(token: ScalarToken, value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? '');
  if (Number.isFinite(parsed)) return parsed;
  const fallback = Number.parseFloat(token.default);
  return Number.isFinite(fallback) ? fallback : token.min;
}

/**
 * A slider's number back to a token value.
 *
 * Rounded to the step's own precision: `0.05` steps accumulate to
 * `0.30000000000000004`, and a token written like that is both unreadable in the
 * CSS and never equal to the preset it was dragged onto.
 */
export function scalarValue(token: ScalarToken, value: number): string {
  const decimals = decimalsFor(token.step);
  return `${value.toFixed(decimals).replace(/\.?0+$/, '') || '0'}${token.unit}`;
}

function decimalsFor(step: number): number {
  if (Number.isInteger(step)) return 0;
  return String(step).split('.')[1]?.length ?? 2;
}

/** True for the two tokens silica documents as an on/off switch rather than a dial. */
export function isSwitchToken(token: ScalarToken): boolean {
  return token.min === 0 && token.max === 1 && token.step === 1;
}

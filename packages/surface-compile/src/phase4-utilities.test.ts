// Reachability guard for the Phase 4 inspector controls (docs/builder/04 §5 risk).
//
// Every NEW structured control added in Phase 4 emits a Tailwind utility token.
// A control that emits a class the compiler silently DROPS is "worse than no
// control" (docs/builder/04 §5) — so this proves, against the REAL Tailwind v4
// compiler, that every token a Phase 4 control can write actually produces a CSS
// rule. The list mirrors the tokens in
//   apps/dashboard/app/(dashboard)/builder/_builder/class-controls.ts
// (kept here as a fixture so surface-compile keeps its clean dependency direction
// — it never imports dashboard code). If a control's vocabulary changes, update
// this list; a dropped token fails loudly here instead of no-op'ing in the UI.

import { describe, expect, it } from 'vitest';
import { compileClasses } from './compile';

// Each token, once compiled, must yield a rule whose selector contains the
// token's escaped class name. We assert the *base* (un-prefixed) utility emits a
// declaration body — i.e. the compiler recognized it.
async function emits(token: string): Promise<boolean> {
  const css = await compileClasses([token]);
  return css.trim().length > 0;
}

// Grouped exactly as the Phase 4 controls group them, so a failure points at the
// control to fix.
const TYPOGRAPHY = [
  'underline',
  'line-through',
  'overline',
  'no-underline',
  'truncate',
  'line-clamp-2',
  'line-clamp-3',
  'line-clamp-4',
  'line-clamp-none',
  'whitespace-normal',
  'whitespace-nowrap',
  'whitespace-pre',
  'whitespace-pre-line',
  'whitespace-pre-wrap',
  'break-normal',
  'break-words',
  'break-all',
  'break-keep',
];

const LAYOUT = [
  'flex-nowrap',
  'flex-wrap',
  'flex-wrap-reverse',
  'grid-rows-1',
  'grid-rows-2',
  'grid-rows-3',
  'grid-rows-6',
  'grid-flow-row',
  'grid-flow-col',
  'grid-flow-row-dense',
  'grid-flow-col-dense',
  'justify-items-start',
  'justify-items-center',
  'justify-items-end',
  'justify-items-stretch',
  'content-start',
  'content-center',
  'content-end',
  'content-between',
  'content-around',
  'content-stretch',
  'justify-around',
  'justify-evenly',
  'items-baseline',
  'gap-x-4',
  'gap-y-2',
];

const CHILD_LAYOUT = [
  'grow',
  'grow-0',
  'shrink',
  'shrink-0',
  'basis-1/2',
  'basis-[12rem]',
  'order-1',
  'order-first',
  'order-last',
  'order-none',
  'self-auto',
  'self-start',
  'self-center',
  'self-end',
  'self-stretch',
];

const BACKGROUND = [
  'bg-linear-to-r',
  'bg-linear-to-l',
  'bg-linear-to-t',
  'bg-linear-to-b',
  'bg-linear-to-tr',
  'bg-linear-to-br',
  'bg-linear-to-bl',
  'bg-linear-to-tl',
  'bg-radial',
  'bg-conic',
  'from-primary',
  'from-base-100',
  'from-transparent',
  'via-accent',
  'via-secondary',
  'to-secondary',
  'to-neutral',
  'to-transparent',
  'bg-auto',
  'bg-cover',
  'bg-contain',
  'bg-center',
  'bg-top',
  'bg-bottom',
  'bg-left',
  'bg-right',
  'bg-no-repeat',
  'bg-repeat',
  'bg-repeat-x',
  'bg-repeat-y',
];

const EFFECTS = [
  'shadow-primary',
  'shadow-accent',
  'shadow-neutral',
  'shadow-black',
  'ring-0',
  'ring-1',
  'ring-2',
  'ring-4',
  'ring-primary',
  'ring-accent',
  'ring-neutral',
  'ring-base-300',
  'mix-blend-normal',
  'mix-blend-multiply',
  'mix-blend-screen',
  'mix-blend-overlay',
  'mix-blend-darken',
  'mix-blend-lighten',
  'mix-blend-difference',
  'blur-sm',
  'blur-md',
  'blur-lg',
  'brightness-50',
  'brightness-110',
  'brightness-150',
  'contrast-125',
  'saturate-150',
  'grayscale',
  'grayscale-0',
  'backdrop-blur-sm',
  'backdrop-blur-md',
  'backdrop-blur-lg',
  'skew-x-3',
  'skew-y-3',
  'origin-center',
  'origin-top',
  'origin-bottom',
  'origin-left',
  'origin-right',
  'origin-top-left',
  'duration-150',
  'duration-300',
  'duration-700',
  'delay-150',
  'delay-300',
];

const BORDERS = [
  'border-t',
  'border-t-0',
  'border-t-2',
  'border-t-4',
  'border-r',
  'border-r-2',
  'border-b',
  'border-b-2',
  'border-l',
  'border-l-2',
  'rounded-tl-none',
  'rounded-tl-field',
  'rounded-tl-box',
  'rounded-tl-2xl',
  'rounded-tl-full',
  'rounded-tr-box',
  'rounded-br-box',
  'rounded-bl-box',
];

const ALL = {
  TYPOGRAPHY,
  LAYOUT,
  CHILD_LAYOUT,
  BACKGROUND,
  EFFECTS,
  BORDERS,
};

describe('Phase 4 control tokens compile (no silent drops)', () => {
  for (const [group, tokens] of Object.entries(ALL)) {
    it(`${group}: every token emits CSS`, async () => {
      const dropped: string[] = [];
      for (const token of tokens) {
        if (!(await emits(token))) dropped.push(token);
      }
      expect(dropped, `dropped tokens in ${group}`).toEqual([]);
    });
  }
});

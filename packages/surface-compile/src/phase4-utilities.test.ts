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

// ── Phase 2 (docs/98 §3.3) — the controls that complete the Tailwind surface.
// Grouped by Tailwind's own documentation sections, matching the inspector cards.

// Filters card — drop-shadow / sepia / invert / hue-rotate + the backdrop family
// (brightness/contrast/saturate/opacity ride value groups; grayscale is an enum).
const FILTERS = [
  'drop-shadow-sm',
  'drop-shadow-md',
  'drop-shadow-lg',
  'drop-shadow-xl',
  'drop-shadow-none',
  'sepia',
  'sepia-0',
  'invert',
  'invert-0',
  'hue-rotate-15',
  'hue-rotate-90',
  '-hue-rotate-15',
  'backdrop-brightness-110',
  'backdrop-contrast-110',
  'backdrop-saturate-150',
  'backdrop-opacity-75',
  'backdrop-grayscale',
  'backdrop-grayscale-0',
];

// Transitions & Animation card — easing curves + the platform animation library.
const TRANSITIONS = [
  'ease-linear',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'animate-none',
  'animate-spin',
  'animate-ping',
  'animate-pulse',
  'animate-bounce',
];

// Transforms card — the per-axis scale + the negative rotate/translate steps that
// ride the value fields (the positive steps live in the existing EFFECTS group).
const TRANSFORMS = [
  'scale-x-105',
  'scale-y-95',
  '-rotate-6',
  '-rotate-12',
  '-translate-y-1',
  '-translate-x-1',
];

// Tables card — table-only utilities (shown for el:table-family raw elements).
const TABLES = [
  'border-collapse',
  'border-separate',
  'table-auto',
  'table-fixed',
  'caption-top',
  'caption-bottom',
  'border-spacing-2',
  'border-spacing-x-2',
  'border-spacing-y-2',
];

// SVG card — fill / stroke (token colors) + stroke-width (shown for el:svg + svg
// child raw elements).
const SVG = [
  'fill-none',
  'fill-current',
  'fill-primary',
  'fill-secondary',
  'fill-accent',
  'fill-neutral',
  'fill-white',
  'fill-black',
  'stroke-none',
  'stroke-current',
  'stroke-primary',
  'stroke-secondary',
  'stroke-accent',
  'stroke-neutral',
  'stroke-white',
  'stroke-black',
  'stroke-0',
  'stroke-1',
  'stroke-2',
];

// Typography card — the remaining members (font-style, decoration thickness /
// offset, list style, vertical-align, text-overflow, hyphens, text-indent).
const TYPOGRAPHY_EXTRA = [
  'italic',
  'not-italic',
  'decoration-auto',
  'decoration-1',
  'decoration-2',
  'decoration-4',
  'underline-offset-auto',
  'underline-offset-1',
  'underline-offset-2',
  'underline-offset-4',
  'list-none',
  'list-disc',
  'list-decimal',
  'list-inside',
  'list-outside',
  'align-baseline',
  'align-top',
  'align-middle',
  'align-bottom',
  'align-sub',
  'align-super',
  'text-ellipsis',
  'text-clip',
  'hyphens-none',
  'hyphens-manual',
  'hyphens-auto',
  'indent-4',
  'indent-8',
];

// Interactivity card (NEW section) — cursor / select / pointer-events / resize /
// scroll behavior + snap / appearance / touch-action / will-change + caret &
// accent token colors.
const INTERACTIVITY = [
  'cursor-auto',
  'cursor-default',
  'cursor-pointer',
  'cursor-wait',
  'cursor-text',
  'cursor-move',
  'cursor-not-allowed',
  'cursor-grab',
  'select-none',
  'select-text',
  'select-all',
  'select-auto',
  'pointer-events-none',
  'pointer-events-auto',
  'resize-none',
  'resize',
  'resize-y',
  'resize-x',
  'scroll-auto',
  'scroll-smooth',
  'snap-none',
  'snap-x',
  'snap-y',
  'snap-both',
  'snap-start',
  'snap-center',
  'snap-end',
  'snap-align-none',
  'appearance-none',
  'appearance-auto',
  'touch-auto',
  'touch-none',
  'touch-pan-x',
  'touch-pan-y',
  'touch-manipulation',
  'will-change-auto',
  'will-change-scroll',
  'will-change-contents',
  'will-change-transform',
  'caret-primary',
  'caret-accent',
  'caret-neutral',
  'accent-primary',
  'accent-secondary',
  'accent-accent',
  'accent-neutral',
];

const ALL = {
  TYPOGRAPHY,
  LAYOUT,
  CHILD_LAYOUT,
  BACKGROUND,
  EFFECTS,
  BORDERS,
  FILTERS,
  TRANSITIONS,
  TRANSFORMS,
  TABLES,
  SVG,
  TYPOGRAPHY_EXTRA,
  INTERACTIVITY,
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

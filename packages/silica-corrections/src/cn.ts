// Class-name join, corrected for silica's `soft` treatment.
//
// It lives in @wizeworks/silica-corrections rather than in a brand package for
// the same reason every other file here does: it states no value, it fixes a
// third-party tool's misreading of silica, and BOTH brands need it. It sat in
// @sparx/ui until 2026-08-16, which is how sparx's brand package ended up inside
// the Piggles console image — `@piggles/console → @sparx/cms-editor →
// @sparx/ui → @sparx/brand`, a whole chain held up by this one function and a
// dead type. @sparx/ui re-exports it, so nothing downstream changed.

import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// silicaui layers a `soft` TREATMENT on top of a color utility — `bg-module
// bg-soft` paints `color-mix(module 15%, base)`, `text-primary text-soft`
// mutes the ink, etc. The two classes are meant to coexist. Default
// tailwind-merge, however, classifies `bg-soft` / `text-soft` / `border-soft`
// as background/text/border COLOR utilities, so `cn('bg-module', 'bg-soft')`
// drops `bg-module` and the tint silently disappears. Register the `soft`
// family as dedicated class groups (a full-literal path is more specific than
// the default color validator, so these resolve here) — now the color and the
// soft treatment are orthogonal and both survive a merge.
const twMerge = extendTailwindMerge<
  'silica-soft' | 'silica-bg-soft' | 'silica-text-soft' | 'silica-border-soft'
>({
  extend: {
    classGroups: {
      'silica-soft': ['soft'],
      'silica-bg-soft': ['bg-soft'],
      'silica-text-soft': ['text-soft'],
      'silica-border-soft': ['border-soft'],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

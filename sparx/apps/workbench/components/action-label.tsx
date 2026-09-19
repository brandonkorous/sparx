// A control's name, shown when there is room and STILL THERE when there is not.
//
// The pattern this replaces is everywhere in the console:
//
//   <Button onClick={togglePaused}>
//     <Icon glyph={faPause} aria-hidden />
//     <span className="hidden @lg:inline">Pause</span>
//   </Button>
//
// `hidden` is `display: none`. A hidden element is not merely invisible — it is
// removed from the ACCESSIBILITY TREE. The icon beside it is `aria-hidden`,
// deliberately, because an icon is decoration. So below that width the button
// has no accessible name at all: a screen reader announces "button", and the
// only thing a sighted phone user gets is a glyph.
//
// Measured 2026-09-18 across both consoles: 87 labels written this way, 44 of
// them on a control with no `aria-label`, no `title` and no tooltip to fall back
// on. Three of those sit side by side on one toolbar (Turn on / Pause / Sync
// now), so a phone showed three unlabeled circles where one of them pauses the
// business's stock feed.
//
// The fix is one word of CSS, not a caption: `sr-only` parks the text off-screen
// while LEAVING IT IN THE TREE, and `not-sr-only` brings it back at the width
// that has room. The name is never gone, only unpainted.
//
// WHAT THIS IS NOT. It is not permission to put icon-only controls in a toolbar.
// `pane-toolbar-actions.tsx` makes the stronger argument and it still stands:
// two different actions rendered as two identical glyphs are ambiguous to a
// SIGHTED person too, and an accessible name does nothing for them — those
// belong in the overflow popover wearing their labels as rows. This component is
// for the controls that legitimately shrink (a detail pane's own Save, a single
// action with a distinct glyph), and for making the rest correct TODAY rather
// than after a thirty-file refactor. [[feedback_a_fix_leaves_its_neighbour_behind]]

import type { ReactNode } from 'react';

/** Container-query width at which the label is painted. */
export type LabelFrom = 'sm' | 'md' | 'lg' | 'xl';

// Written out rather than built from the prop: Tailwind reads source text, so a
// concatenated class name is a class that never gets generated.
const SHOWN_FROM: Record<LabelFrom, string> = {
  sm: 'sr-only @sm:not-sr-only',
  md: 'sr-only @md:not-sr-only',
  lg: 'sr-only @lg:not-sr-only',
  xl: 'sr-only @xl:not-sr-only',
};

export interface ActionLabelProps {
  /** The width from which the name is painted. Below it, the name is still read. */
  from?: LabelFrom;
  children: ReactNode;
}

/**
 * Wrap the words that name a control.
 *
 * `not-sr-only` resets `padding` and `margin` to zero, which is why this is a
 * bare `<span>` with no spacing of its own — the button's own gap does that
 * work. Putting `sr-only` on a BUTTON instead fights `.btn`'s padding and
 * clips the control through its own text (see `skip-to-workspace.tsx`).
 */
export function ActionLabel({ from = 'lg', children }: ActionLabelProps) {
  return <span className={SHOWN_FROM[from]}>{children}</span>;
}

'use client';

// The bar of controls at the top of a pane — and the surface it sits on.
//
// THE HOUSE PATTERN IS "FLOATING", NOT "DOCKED". A pane is a recessed base-200
// surface; the toolbar and the content are base-100 cards lifted onto it,
// separated by the gap between them. The alternative — a full-bleed base-100 bar
// welded to the pane edge with a hairline under it — was what half the app did,
// and side by side the two read as two different products.
//
// It lives here as a component rather than as a class string everyone copies,
// because "everyone copies it" is exactly how the app ended up with two patterns
// in the first place. One import, one appearance, and a future change to the
// bar's padding or colour lands everywhere at once.
//
// Built on silica's Toolbar, so every bar gets roving arrow-key focus for free:
// the whole toolbar is ONE tab stop that you then arrow across, rather than five
// separate stops between you and the content.

import { Toolbar } from '@wizeworks/silicaui-react';
import { PaneBetaNotice } from './module-beta-notice';

/**
 * The pane root every list and editor sits in.
 *
 * The gutter tightens under 32rem: in a pane docked beside an editor, 12px a
 * side is real column width, and at that size the surfaces already read apart by
 * colour alone. `@container` is here because everything inside must respond to
 * PANE width — a pane's width and the window's are unrelated, and a viewport
 * breakpoint would leave a narrow pane on a wide monitor showing a six-column
 * table in 300px.
 */
export const PANE_SHELL = 'bg-base-200 @container flex h-full flex-col gap-2 p-2 @lg:gap-3 @lg:p-3';

interface PaneToolbarProps {
  /**
   * What this bar controls, e.g. "Invoice list controls". Required, not optional:
   * a toolbar is an ARIA landmark, and an unlabelled one is announced as a bare
   * "toolbar" — useless when a pane has two.
   */
  label: string;
  /**
   * Let the bar wrap onto a second line when it runs out of room.
   *
   * Off by default, and that default is the considered one: a wrapping toolbar
   * shoves the content down and reflows as you type into the search box. Prefer
   * making things GIVE WAY instead — drop a count, shed a secondary button's
   * label to its icon, let the search box shrink — so the bar stays one line.
   * Turn this on only when a bar genuinely cannot be reduced any further.
   */
  wrap?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function PaneToolbar({ label, wrap, className, children }: PaneToolbarProps) {
  return (
    <>
      <Toolbar
        aria-label={label}
        size="sm"
        // w-full so an `ml-auto` on the right-hand group has room to push against —
        // a Toolbar is content-width by default, which silently collapses the gap
        // and leaves the primary action clumped against the filters.
        //
        // The min-height is the whole point of pinning this here. A bar's height
        // is otherwise driven by its TALLEST CHILD, so a toolbar holding buttons
        // (32px controls) came out at 50px while one holding only badges and text
        // (20px) came out at 38 — and switching tabs made the chrome jump. The
        // floor is spelled out as its parts rather than as `50px` so it survives
        // silica retuning its control sizes: one `sm` control, the bar's padding,
        // and its hairline borders.
        className={`bg-base-100 min-h-[calc(2rem+1rem+2px)] w-full shrink-0 gap-2 p-2 ${wrap ? 'flex-wrap' : ''} ${className ?? ''}`}
      >
        {children}
      </Toolbar>
      {/* A beta module's standing heads-up, as the bar's SIBLING in PANE_SHELL — it
          inherits the shell's gap and card rhythm, and the bar above it never moves.
          Rendered from here rather than from each surface because a dock has no landing
          screen every route passes through; this way one seam covers every surface of a
          beta module, including ones registered later. Null for every module that is not
          in beta, which is nearly all of them. See module-beta-notice.tsx. */}
      <PaneBetaNotice />
    </>
  );
}

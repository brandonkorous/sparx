// The site-nav cluster — NavShell plus the class strings a NavItem, a NavItem
// dropdown, and a NavMegamenu wear.
//
// silicaui ships `Navbar` (the bar and its three zones) and `NavigationMenu` (a
// Base UI popover menu), but not this: a nav whose items are BUILDER NODES,
// which brings two constraints neither silica component can satisfy.
//
//   1. Children render EXACTLY ONCE. A node's id is both its React key and its
//      dnd-kit sortable id, so a shell that renders an inline row AND a separate
//      drawer copy would mint duplicate ids and silently break layer reordering
//      in the editor (root CLAUDE.md). So the row↔hamburger swap is done in pure
//      CSS over ONE subtree, via a native `<details>` disclosure.
//   2. The swap is driven by the FRAME, not the viewport — the `bx-frame`
//      container query — so the nav collapses at the SIMULATED device width in
//      the canvas preview, exactly as it will on a real phone.
//
// Everything visual is silica tokens (`bg-base-100`, `border-base-300`,
// `rounded-box`, `rounded-field`) through Tailwind utilities. Two deliberate
// changes from the retired `st-*` stylesheet:
//
//   · The floating panels no longer carry a drop shadow. They separate from the
//     page with an edge and a base-tone shift instead (root DESIGN.md).
//   · The panels are mobile-first: in flow (an accordion) on a narrow frame,
//     floating once it is wide. The old rules got there by having the shell
//     reach INTO its descendants, so a dropdown only behaved correctly inside a
//     NavShell; these hold wherever the item is dropped.
//
// SERVER component — a `<details>` disclosure needs no JavaScript.

import * as React from 'react';
import { cx } from '@wizeworks/silicaui-react/server';

/** The frame container query that flips the nav from stacked to inline. `@3xl`
 *  is Tailwind's 48rem/768px container step — the same breakpoint the rest of
 *  the builder frame collapses at. */
const WIDE = '@3xl/bx-frame';

/** A plain nav link. Ink is deliberately INHERITED: the link takes the color of
 *  whatever bar or footer it was dropped into, which is why it sets no text
 *  color of its own (RULE #4). `bx-nav-item` is a structural marker, not a
 *  style — the dropdown panels use it to lay their children out as rows. */
export const NAV_ITEM_CLASS = 'bx-nav-item font-medium no-underline';

/** An inline icon inside a nav item — sized to the text, never shrinking. */
export const NAV_ICON_CLASS = 'size-[1em] shrink-0';

/** A NavItem that owns child NavItems: a CSS-only `<details>` dropdown. */
export const NAV_DROPDOWN_CLASS = 'group/navdrop relative inline-block';

/** The dropdown/megamenu trigger. The UA disclosure triangle is suppressed on
 *  both engines (`list-none` covers Firefox, the pseudo covers WebKit). */
export const NAV_SUMMARY_CLASS =
  'inline-flex cursor-pointer list-none items-center gap-1.5 font-medium [&::-webkit-details-marker]:hidden';

/** The trigger's caret, flipped while the disclosure is open. */
export const NAV_CARET_CLASS =
  'text-[0.7em] leading-none transition-transform group-open/navdrop:rotate-180';

// Rows inside a floating panel: full-width, padded, with their own hover tone.
// Applied to descendants so it still reaches an item the host walker wrapped.
const PANEL_ROWS =
  '[&_.bx-nav-item]:rounded-field [&_.bx-nav-item]:block [&_.bx-nav-item]:px-2.5 [&_.bx-nav-item]:py-1.5 [&_.bx-nav-item]:hover:bg-base-300';

// Floating-panel chrome, applied only once the frame is wide. Below that the
// panel stays in flow and indents instead, so a narrow screen never has to
// scroll a layer that overflows it.
const PANEL_FLOAT = [
  `${WIDE}:absolute ${WIDE}:top-full ${WIDE}:left-0 ${WIDE}:z-40`,
  `${WIDE}:mt-2 ${WIDE}:rounded-box ${WIDE}:border ${WIDE}:border-base-300 ${WIDE}:bg-base-100`,
].join(' ');

/** The panel a NavItem dropdown opens. */
export const NAV_DROPDOWN_PANEL_CLASS = cx(
  'mt-0.5 flex flex-col gap-0.5 ps-3',
  PANEL_FLOAT,
  `${WIDE}:min-w-48 ${WIDE}:p-2 ${WIDE}:ps-2`,
  PANEL_ROWS
);

/** A NavMegamenu: the same disclosure, opening a wide multi-column panel. */
export const NAV_MEGA_CLASS = NAV_DROPDOWN_CLASS;

const MEGA_COLUMNS: Record<'2' | '3' | '4', string> = {
  '2': `${WIDE}:grid-cols-2`,
  '3': `${WIDE}:grid-cols-3`,
  '4': `${WIDE}:grid-cols-4`,
};

/** The megamenu's panel at a given column count. One column on a narrow frame. */
export function navMegaPanelClass(columns: '2' | '3' | '4'): string {
  return cx(
    'mt-0.5 grid grid-cols-1 gap-x-8 gap-y-5 ps-3',
    PANEL_FLOAT,
    `${WIDE}:min-w-[32rem] ${WIDE}:max-w-[min(48rem,calc(100vw-2rem))] ${WIDE}:p-5 ${WIDE}:ps-5`,
    MEGA_COLUMNS[columns],
    // Mega columns list their links as plain rows — no pill, just a hover tint on
    // the ink, so a column of eight links doesn't read as eight buttons.
    '[&_.bx-nav-item]:block [&_.bx-nav-item]:py-1 [&_.bx-nav-item]:hover:text-primary'
  );
}

// ── NavShell ─────────────────────────────────────────────────────────────────

export type NavShellOrientation = 'row' | 'stack';

export interface NavShellProps {
  /** `row` (primary/header) collapses to a hamburger on narrow frames; `stack`
   *  (footer/secondary) is a plain static column. Defaults to `row`. */
  orientation?: NavShellOrientation;
  /** Accessible label for the nav landmark. Defaults to `Primary`. */
  label?: string;
  className?: string;
  /** The rendered NavItem nodes — rendered ONCE, shared by row and hamburger. */
  children?: React.ReactNode;
}

function HamburgerIcon(): React.ReactElement {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

export function NavShell({
  orientation = 'row',
  label = 'Primary',
  className,
  children,
}: NavShellProps): React.ReactElement {
  // Stacked (footer/secondary) nav: a plain static column — no hamburger, no
  // disclosure, nothing to collapse.
  if (orientation === 'stack') {
    return (
      <nav
        className={cx('flex flex-col flex-wrap items-start gap-2', className)}
        aria-label={label}
      >
        {children}
      </nav>
    );
  }

  return (
    <nav className={cx('flex items-center', className)} aria-label={label}>
      <details
        className={cx(
          'group/navshell relative',
          // Chromium and WebKit wrap a `<details>`'s non-summary content in a
          // `::details-content` pseudo and SIZE-contain it while closed. That
          // survives `display: flex`, so without this the inline desktop row
          // would collapse to zero width and the whole header nav would vanish.
          // Engines without the pseudo simply ignore the rule.
          `${WIDE}:[&::details-content]:[content-visibility:visible]`
        )}
      >
        <summary
          className={cx(
            'rounded-field flex size-10 cursor-pointer list-none items-center justify-center',
            'hover:bg-base-300 [&::-webkit-details-marker]:hidden',
            `${WIDE}:hidden`
          )}
          aria-label={`Toggle ${label.toLowerCase()} menu`}
        >
          <HamburgerIcon />
        </summary>
        <div
          className={cx(
            // Narrow: a floating disclosure panel, shown only while open.
            'rounded-box border-base-300 bg-base-100 absolute end-0 top-full z-40 mt-2 hidden min-w-48 flex-col items-stretch gap-0.5 border p-2',
            'group-open/navshell:flex',
            // Wide: a static in-bar row, open or not. `!` beats the `hidden`
            // above with one readable rule rather than a specificity chain.
            `${WIDE}:static! ${WIDE}:flex! ${WIDE}:mt-0 ${WIDE}:min-w-0 ${WIDE}:flex-row ${WIDE}:items-center ${WIDE}:gap-5 ${WIDE}:rounded-none ${WIDE}:border-0 ${WIDE}:bg-transparent ${WIDE}:p-0`,
            // Narrow rows get a tap target; wide ones sit inline and unpadded.
            '[&>.bx-nav-item]:rounded-field [&>.bx-nav-item]:hover:bg-base-300 [&>.bx-nav-item]:block [&>.bx-nav-item]:px-2.5 [&>.bx-nav-item]:py-2.5',
            `${WIDE}:[&>.bx-nav-item]:inline-flex ${WIDE}:[&>.bx-nav-item]:rounded-none ${WIDE}:[&>.bx-nav-item]:p-0 ${WIDE}:[&>.bx-nav-item]:hover:bg-transparent`
          )}
        >
          {children}
        </div>
      </details>
    </nav>
  );
}
NavShell.displayName = 'NavShell';

'use client';

// The bar of controls at the top of a pane — and the surface it sits on.
//
// THE HOUSE PATTERN IS "FLOATING", NOT "DOCKED". A pane is a recessed base-200
// surface; the toolbar and the content are base-100 cards lifted onto it. A
// full-bleed bar welded to the pane edge was what half the app did, and side by
// side the two read as two different products.
//
// One import, one appearance: a class string everyone copies is exactly how the
// app ended up with two patterns. Built on silica's Toolbar, so a bar is ONE tab
// stop you arrow across rather than five between you and the content.
//
// ── THE SLOTS, AND WHY `children` WAS NOT ENOUGH ────────────────────────────
//
// `children` + `flex-wrap` was a spill, not a strategy: whatever did not fit fell
// to row two in DOM order, and DOM order meant nothing. The slots gave it meaning
// — status, search, what narrows the list, then what you can do — so wrapping is
// the honest answer to "too much content", and is back ON.
//
// It needed two things alongside it. ATOMICITY: every child keeps its whole width
// or takes the next row, and only `search` may give, down to its floor. Squeezing
// was the bug — silica's Filter wraps internally, so the one child that could
// shrink was the one that broke apart while the selects beside it sat full. And a
// CEILING of two rows: a third is no longer a bar, and no fixed width predicts it,
// so `useToolbarFit` folds the crowded bar away instead (that file on why it is
// safe to measure). Each slot answers "not enough room" its own way, below.
//
// ── THE HARD RULE: A COMMIT ACTION IS ALWAYS `primary` ─────────────────────
//
// Save, Create, Publish, Send — anything that commits what a person just did —
// goes in `primary` and nowhere else. `controls` RELOCATES, and a Save moved into
// a popover is the one control they came to press, hidden behind a tap they have
// no reason to expect. The failure is invisible at the width anyone develops at.
// Enforced by scripts/check-toolbar-primary.mjs, in the pre-push guard.
// It scans BOTH consoles. It did not until 2026-09-19 — it computed its scan
// root from its own location inside piggles/scripts, so this line was a claim
// rather than a fact for one of the two files that carries it.
//
// `activeControls` is what keeps the collapse honest — see PaneToolbarOverflow.

import { useRef } from 'react';
import { Text, Toolbar } from '@wizeworks/silicaui-react';
import { CopyPaneLink, usePaneHasLink } from './copy-pane-link';
import { PaneBetaNotice } from './module-beta-notice';
import { CollapsedToolbar } from './pane-toolbar-overflow';
import { ToolbarFilterChips, activeFilterCount, type ToolbarFilter } from './pane-toolbar-filters';
import {
  ToolbarActionButtons,
  ToolbarPrimaryAction,
  type ToolbarAction,
} from './pane-toolbar-actions';
import { ToolbarViewsControl, type ToolbarViews } from './pane-toolbar-views';
import { useToolbarFit } from '../lib/use-toolbar-fit';

/**
 * The pane root every list and editor sits in.
 *
 * The gutter tightens under 32rem: docked beside an editor, 12px a side is real
 * column width. `@container` because everything inside responds to PANE width —
 * a viewport breakpoint would leave a narrow pane on a wide monitor showing a
 * six-column table in 300px.
 */
export const PANE_SHELL = 'bg-base-200 @container flex h-full flex-col gap-2 p-2 @lg:gap-3 @lg:p-3';

/**
 * PANE_SHELL for a pane that scrolls as ONE column, rather than holding a
 * scrolling region inside it.
 *
 * `[&>*]:shrink-0` is the whole reason this exists, and leaving it off does not
 * look like a bug — it looks like a shorter form. PANE_SHELL is a flex column,
 * and silica's `.card` sets `overflow: hidden`, which makes `min-height: auto`
 * resolve to 0: a card is then free to shrink below its own content and clip the
 * remainder, with no scrollbar of its own to get it back. Faced with a pane
 * shorter than the form, the column squeezes every card instead of scrolling,
 * the shell measures as fitting, and the hidden part is unreachable.
 *
 * A counting schedule in a 908px pane was hiding 459px of itself that way,
 * including the location dropdown and the warning that says the schedule covers
 * nothing (issue 505). Same reason the toolbar row below carries `shrink-0`.
 */
export const PANE_SHELL_SCROLL = `${PANE_SHELL} overflow-y-auto [&>*]:shrink-0`;

interface PaneToolbarProps {
  /**
   * What this bar controls, e.g. "Invoice list controls". Required, not optional:
   * a toolbar is an ARIA landmark, and an unlabelled one is announced as a bare
   * "toolbar" — useless when a pane has two.
   */
  label: string;
  /** The search control. Keeps a floor width at every pane size. */
  search?: React.ReactNode;
  /** Counts, totals, state — information rather than a control. Never hidden. */
  status?: React.ReactNode;
  /**
   * Has the read behind `status` landed?
   *
   * A COUNT IS A MEASUREMENT AND MUST NOT BE PRINTED BEFORE IT IS TAKEN. Almost
   * every status slot in the console is `rows.length`, off a `data?.items ?? []`,
   * so while the query is in flight the array is empty and the bar asserts a
   * confident ZERO over a pane that is still loading: "0 messages", "No mailbox
   * connected yet", "No dashboards yet". On a failed read it says it FOREVER,
   * over a body that is explaining the server could not be reached.
   *
   * Measured 2026-09-25 across both consoles: 43 toolbars print a count off an
   * array with a `?? []` fallback, and 41 of them did it unguarded.
   *
   * Leave it out and nothing changes — a status that is not a count (a saved
   * state, a name, a warning) has nothing to wait for. Pass it and the bar keeps
   * its own counsel until it knows. [[feedback_never_present_absence_as_measurement]]
   */
  statusReady?: boolean;
  /** The read behind `status` failed, so the count is UNKNOWN rather than zero. */
  statusFailed?: boolean;
  /** The one action this surface exists for, as a node — rendered exactly as
   *  written, at every width. Use for a Save, or anything bespoke. */
  primary?: React.ReactNode;
  /**
   * The same action as VALUES, for the simple icon + label case ("+ Add a
   * thing"). Choosing this slot declares the icon can carry it alone, so the bar
   * drops the label when narrow — a Save cannot claim that.
   */
  primaryAction?: ToolbarAction;
  /**
   * Filters as VALUES, so the bar picks their shape: chips when there is room,
   * labelled selects in the popover when there is not. pane-toolbar-filters.tsx.
   */
  filters?: readonly ToolbarFilter[];
  /**
   * Secondary actions as values, so they wear their labels in the popover
   * instead of collapsing to bare icons. `primary` is the ONE thing the surface
   * exists to do; everything else it offers belongs here. pane-toolbar-actions.tsx.
   */
  actions?: readonly ToolbarAction[];
  /**
   * Saved views: the list's identity, plus anything it filters by outside
   * `filters`. The bar owns the filter values, so it composes the snapshot and
   * applies one back — most lists need only `{ target }`.
   *
   * `target` is the surface's REGISTRY KEY as a path: dots to slashes, trailing
   * `.list` dropped, leading `/` — `commerce.products.list` → `/commerce/products`.
   */
  views?: ToolbarViews;
  /** Anything bespoke. Relocated into the popover on a narrow pane, as-is. */
  controls?: React.ReactNode;
  /** The surface's `<RefreshButton>`. Joins the popover on a narrow pane. */
  refresh?: React.ReactNode;
  /**
   * Extra count for anything in `controls` that is narrowing the list. `filters`
   * groups are counted for you. It exists because a collapsed toolbar that hides
   * the reason a list is short is a screen lying about itself.
   */
  activeControls?: number;
  /**
   * @deprecated Unclassified children render inline exactly as before, which
   * means they still overflow on a narrow pane. Move them into the slots above.
   */
  children?: React.ReactNode;
  className?: string;
}

/**
 * A picker that must be as wide as the NAME inside it.
 *
 * silica draws a bare `.select` at `width: 100%`, so a picker dropped into a
 * card stretches the width of the pane. The obvious answer is a cap - and a cap
 * is a width WE chose for a word the business owner typed, so it clips: the
 * recipe pane's location picker read "Fulfillment Cente" with 700 pixels free
 * beside it. This pair answers both at once: as wide as its widest option,
 * never wider than the room it is in.
 *
 * The bar applies it to its own slots through ATOMIC below. A picker drawn
 * anywhere ELSE in a pane has to ask for it, which is what this export is for.
 * Tailwind reads class names literally, so ATOMIC spells the same two utilities
 * out rather than composing them from here.
 */
export const FITS_ITS_NAME = 'w-auto max-w-full';

/**
 * Makes a slot's controls ATOMIC without moving them: `contents` keeps each one a
 * direct item of the bar's row (several surfaces aim an `ml-auto` at it), and
 * `shrink-0` is the fix — a control keeps its width or takes the next row, never
 * both. `w-auto` undoes silica's `width:100%` on a bare `.select`/`.input`, which
 * a wrapping row would otherwise stretch across the pane.
 *
 * `max-w-full` here OUTRANKS a `max-w-40` written on the control itself, so a
 * cap inside this slot has never done anything. Do not write one: it reads as a
 * ceiling to the next person, and the day that JSX is lifted out of the bar it
 * starts clipping. scripts/check-select-name-width.mjs holds the line.
 */
const ATOMIC =
  'contents [&>*]:shrink-0 [&>.select]:w-auto [&>.select]:max-w-full [&>.input]:w-auto [&>.input]:max-w-full';

export function PaneToolbar({
  label,
  search,
  status,
  statusReady,
  statusFailed,
  primary,
  primaryAction,
  filters,
  actions,
  views,
  controls,
  refresh,
  activeControls = 0,
  children,
  className,
}: PaneToolbarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const hasFilters = Boolean(filters && filters.length > 0);
  const hasActions = Boolean(actions && actions.length > 0);
  const hasLink = usePaneHasLink();
  // The bar states what it is holding; the hook decides whether that still fits.
  // A crowded or narrow pane folds EVERYTHING foldable, the copy-link included —
  // listing only some slots made the bar unpredictable: sometimes a menu,
  // sometimes one bare icon.
  const { narrow, collapsed } = useToolbarFit(barRef, {
    filters,
    actions,
    controls,
    views,
    refresh,
    primary,
    hasLink,
  });
  // Counted here rather than by each surface: the bar owns the filter values, so
  // it is the only place that cannot fall out of step with them.
  const activeCount = activeFilterCount(filters) + activeControls;

  return (
    <>
      <div ref={barRef} className="w-full shrink-0">
        <Toolbar
          aria-label={label}
          size="sm"
          // w-full so an `ml-auto` on the right-hand group has room to push against —
          // a Toolbar is content-width by default, which silently collapses the gap.
          //
          // A bar's height is otherwise driven by its TALLEST CHILD: one holding
          // buttons came out at 50px, one holding only badges at 38, and switching
          // tabs made the chrome jump. The floor is spelled out as its parts, so it
          // survives silica retuning its control sizes; `flex-wrap` raises the
          // ceiling only when there is genuinely more than a row's worth to hold.
          className={`bg-base-100 min-h-[calc(2rem+1rem+2px)] w-full flex-wrap gap-2 p-2 [&:has(>.contents>.ml-auto)>.toolbar-end]:ml-0 [&:has(>.ml-auto:not(.toolbar-end))>.toolbar-end]:ml-0 ${className ?? ''}`}
        >
          {/* Information first; `min-w-0` truncates rather than overflowing. */}
          {status ? (
            <div className="flex min-w-0 items-center gap-2">
              {statusFailed ? (
                <Text as="span" className="shrink-0 text-sm">
                  Could not be read
                </Text>
              ) : statusReady === false ? (
                <Text as="span" className="shrink-0 text-sm">
                  Counting…
                </Text>
              ) : (
                status
              )}
            </div>
          ) : null}

          {/* The one child allowed to give, and only to its floor: `flex-1` alone
              let it shrink to an icon and a sliver of border. */}
          {search ? <div className="max-w-xs min-w-36 flex-1">{search}</div> : null}

          {!collapsed && hasFilters ? (
            <div className={ATOMIC}>
              <ToolbarFilterChips filters={filters ?? []} />
            </div>
          ) : null}
          {controls && !collapsed ? <div className={ATOMIC}>{controls}</div> : null}

          {/* Legacy, unclassified — direct children of the bar, because several
              of them position themselves against it with `ml-auto`. */}
          {children}

          {/* `ml-auto` on the GROUP, not the primary button, so it still pushes
              right on a surface with no primary action — and, once the row wraps,
              keeps the whole group together and right-aligned on its own line.

              `toolbar-end` is a marker the bar's own class reads: when a surface
              pushes its OWN controls right with an `ml-auto`, this group stops
              pushing. Two auto margins split the free space equally, so both
              pushing put the surface's buttons in the MIDDLE of the bar: 61
              toolbars across both consoles, the content editor's Unpublish and
              Save among them. Letting the surface's push win keeps what it asked
              for, its buttons at the right beside this group. */}
          <div className="toolbar-end ml-auto flex shrink-0 items-center gap-2">
            {!collapsed && hasActions ? <ToolbarActionButtons actions={actions ?? []} /> : null}
            {primaryAction ? (
              <ToolbarPrimaryAction action={primaryAction} compact={narrow} />
            ) : null}
            {primary}
            {collapsed ? (
              // Everything foldable, sorted into the popover's two zones — and
              // wearing labels there, because a bar identifies a control by
              // POSITION and a menu has no position to read.
              <CollapsedToolbar
                label={label}
                activeCount={activeCount}
                filters={filters}
                actions={actions}
                views={views}
                controls={controls}
                refresh={refresh}
                hasLink={hasLink}
              />
            ) : (
              <>
                {/* Views belongs HERE, with refresh and the copy link, not out
                    among the surface's own controls. Those three are all about
                    the PANE — which saved question it is showing, whether it is
                    current, how to send it — and they are one shape so they read
                    as one group. A filter narrows this list; a view is the list. */}
                {views ? <ToolbarViewsControl views={views} filters={filters ?? []} /> : null}
                {refresh}
                {/* A link to what you are looking at is a property of the PANE,
                    not of any surface, so it is mounted here. Renders nothing on
                    a pane with no address. */}
                <CopyPaneLink />
              </>
            )}
          </div>
        </Toolbar>
      </div>

      {/* A beta module's standing heads-up, as the bar's SIBLING in PANE_SHELL, so
          it inherits the shell's rhythm and the bar never moves. One seam covers
          every surface of a beta module. See module-beta-notice.tsx. */}
      <PaneBetaNotice />
    </>
  );
}

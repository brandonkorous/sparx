import * as React from 'react';
import { cn } from '../../utils/cn';

// ListPageShell — the standard scroll frame for every list/index page (docs/34
// §7 follow-up). Before this, every list page's `header` + `ListToolbar` +
// list + `Pager` sat in one flat flex column inside the shell's single
// scrolling pane (`#main-content`), so a long list forced the header and
// filters off the top of the screen and the pager off the bottom — exactly
// backwards from a data table, where filters and paging should stay put while
// only the rows scroll.
//
// This owns three fixed regions plus one scrolling one:
//   header/toolbar (pinned top) → list (SCROLLS INTERNALLY, capped to the
//   remaining space) → pager (sized to content, sitting right below the list
//   rather than pinned to the page's bottom edge).
//
// `children` + `pager` share an `h-full` flex column so a `SelectionList`'s
// table Card is free to shrink to its own content height when the list is
// short (no more forced full-height empty card) — flexbox only compresses it
// down to the available space when the row content actually needs more room
// than that, which is what lets `SelectionList`'s own Card/Table wrapper
// become the real scrolling + sticky-header owner instead of this pane. This
// outer pane keeps `overflow-y-auto` purely as a fallback for `children` that
// ISN'T a self-scrolling `SelectionList` (e.g. several stacked cards) — those
// still scroll at the page level exactly as before.
// It also owns the page's horizontal gutter (`px-4 sm:px-6 lg:px-8`) and
// vertical rhythm, replacing the `mx-auto ... <div className="flex flex-col
// gap-6 py-10">` wrapper every list page used to hand-roll.

export interface ListPageShellProps {
  /** `PageHeader` — pinned above the toolbar, never scrolls. This region is a
   *  `flex flex-col gap-6` (flex doesn't collapse margins like block flow
   *  does), so pass `<PageHeader className="mb-0" .../>` — otherwise
   *  `PageHeader`'s own `mb-6` STACKS with this gap for a doubled gap. */
  header?: React.ReactNode;
  /** `ListToolbar` (plus any contextual banner) — pinned directly below the
   *  header, always reachable without scrolling the list. */
  toolbar?: React.ReactNode;
  /** The list body — a `SelectionList`/`EmptyState`/etc. Should size to its
   *  own content (never forced to fill the pane) so `pager` lands right below
   *  it. This, plus `pager`, is the scrolling region. */
  children: React.ReactNode;
  /** `ListPager` — renders in-flow directly below `children`, not pinned to
   *  the page's bottom edge. Omit for a single-page list with no pager. */
  pager?: React.ReactNode;
  className?: string;
}

export function ListPageShell({ header, toolbar, children, pager, className }: ListPageShellProps) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      {(Boolean(header) || Boolean(toolbar)) && (
        <div className="flex shrink-0 flex-col gap-6 px-4 pt-10 pb-6 sm:px-6 lg:px-8">
          {header}
          {toolbar}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-6 lg:px-8">
        <div className="flex h-full min-h-0 flex-col gap-3">
          {children}
          {pager}
        </div>
      </div>
    </div>
  );
}

'use client';

// Re-read this pane from the server, now: a docked pane can sit hours stale while
// window focus never changes. One shared control, always the last child of the
// toolbar, so it is found by where it sits.

import { Button, Timestamp, Tooltip } from '@wizeworks/silicaui-react';
import { faArrowsRotate } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { MENU_ROW, type ToolbarPresentation } from './toolbar-presentation';

interface RefreshButtonProps {
  /** `isFetching` from the query: true for a background refetch too. */
  isFetching: boolean;
  /** `dataUpdatedAt` from the query. Omit only before anything has loaded. */
  updatedAt?: number;
  onRefresh: () => void;
  /** Layout only, and normally unnecessary: PaneToolbar's right-hand GROUP owns
   *  the `ml-auto` push, so passing one here fights it. */
  className?: string;
  /** `bar` (default): the icon, found by position, named by its tooltip. `menu`:
   *  a labelled row in the overflow popover, where there is no position or hover,
   *  so the word and the freshness show. */
  presentation?: ToolbarPresentation;
}

export function RefreshButton({
  isFetching,
  updatedAt,
  onRefresh,
  className,
  presentation = 'bar',
}: RefreshButtonProps) {
  if (presentation === 'menu') {
    return (
      // No `color`: this is chrome, and a bare `.btn` resolves to `base-content`,
      // which is the theme-correct answer for an untyped action.
      <Button
        size="sm"
        variant="ghost"
        className={MENU_ROW}
        loading={isFetching}
        onClick={onRefresh}
      >
        <Icon glyph={faArrowsRotate} className="size-4" aria-hidden />
        <span>Refresh</span>
        {updatedAt ? (
          <span className="ml-auto text-sm [&_time]:text-inherit">
            <Timestamp value={updatedAt} format="relative" />
          </span>
        ) : null}
      </Button>
    );
  }

  return (
    <Tooltip
      // Always right-most, so the tooltip ends at the trigger and stays inboard.
      align="end"
      content={
        // Freshness lives here, not as visible text: it answers "do I need to
        // click this?", asked about once a session.
        updatedAt ? (
          // `[&_time]:text-inherit` is load-bearing: Timestamp's own body ink was
          // near-black on the dark tooltip. Targeting the descendant wins on specificity.
          <span className="[&_time]:text-inherit">
            Refresh · updated <Timestamp value={updatedAt} format="relative" />
          </span>
        ) : (
          'Refresh'
        )
      }
    >
      <Button
        size="sm"
        shape="square"
        className={className}
        aria-label="Refresh"
        // `loading` swaps in silica's spinner AND makes the button
        // non-interactive, so a second click cannot queue a second fetch.
        loading={isFetching}
        onClick={onRefresh}
      >
        <Icon glyph={faArrowsRotate} className="size-4" aria-hidden />
      </Button>
    </Tooltip>
  );
}

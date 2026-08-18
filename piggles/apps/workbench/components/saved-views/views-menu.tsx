'use client';

// The views menu, and the column chooser beside it.
//
// Two controls rather than one combined menu: applying a saved view is something
// people do constantly and choosing columns is something they do once, and
// burying the frequent action inside the rare one is how a feature goes unused.

import { useState } from 'react';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
} from '@wizeworks/silicaui-react';
// A bookmark, not a star. A star means FAVOURITE — a thing you singled out — and
// a saved view is not that: it is a question you can come back to. The column
// chooser already owns the columns glyph, and the filter chips own the funnel.
import { faBookmark } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { afterMenuClose } from '../../lib/defer';
import { MENU_ROW, type ToolbarPresentation } from '../toolbar-presentation';
import { ColumnChooser } from './column-chooser';
import { SaveViewDialog } from './save-view-dialog';
import { ViewAdminItems, ViewRows } from './view-menu-items';
import { normalise, useInvalidateViews, useSavedViews, type ColumnOption } from './data';

export interface SavedViewsBarProps {
  /** The list's identity — a route path, e.g. `/inventory/stock`. PERSISTED, so
   *  changing it orphans every view somebody saved. */
  target: string;
  /** What the list is showing right now, as plain strings. */
  params: Record<string, string>;
  /** Apply a view: the list re-reads its own state from these. */
  onApply: (params: Record<string, string>) => void;
  /** Every column the list CAN show, in display order. Omit on a list whose
   *  columns are fixed — the chooser then never renders. */
  columns?: ColumnOption[];
  visibleColumns?: string[];
  onColumnsChange?: (keys: string[]) => void;
  /** Layout only — e.g. the `ml-auto` when this leads the right-hand group. */
  className?: string;
  /** `menu` relocates both controls into PaneToolbar's overflow popover. */
  presentation?: ToolbarPresentation;
}

interface ViewsMenuProps extends Pick<SavedViewsBarProps, 'target' | 'params' | 'onApply'> {
  onSave: () => void;
  presentation: ToolbarPresentation;
  className?: string;
}

function ViewsMenu({ target, params, onApply, onSave, presentation, className }: ViewsMenuProps) {
  const items = useSavedViews(target).data?.items ?? [];
  // Which view is applied is decided by comparing the PARAMS, not by an id held
  // in state — so the tick is right after a restored layout or a shared link as
  // well as after a click.
  const current = JSON.stringify(normalise(params));
  const active = items.find((view) => JSON.stringify(normalise(view.config.params)) === current);
  const menu = presentation === 'menu';

  // The bar has no room to name the applied view, so the tooltip does.
  const hint = active ? `Saved views · showing “${active.name}”` : 'Saved views';

  const trigger = menu ? (
    <Button
      size="sm"
      variant="ghost"
      className={MENU_ROW}
      {...(active ? { color: 'module' as const } : {})}
    >
      <Icon glyph={faBookmark} className="size-4" aria-hidden />
      <span>{active?.name ?? 'Saved views'}</span>
      {items.length > 0 && !active ? (
        <Badge color="info" variant="soft" size="sm" className="ml-auto">
          {items.length}
        </Badge>
      ) : null}
    </Button>
  ) : (
    // Same geometry as Refresh and Copy link — this is pane chrome, and the
    // three of them read as one group only if they are one shape. Colour is the
    // one thing that still varies: a view being applied is a fact about what you
    // are looking at, and grey cannot say it.
    <Button
      size="sm"
      variant="ghost"
      shape="square"
      aria-label={hint}
      className={className}
      {...(active ? { color: 'module' as const } : {})}
    >
      <Icon glyph={faBookmark} className="size-4" aria-hidden />
    </Button>
  );

  return (
    <DropdownMenu>
      {/* Tooltip OUTSIDE the trigger: both compose by merging onto their child,
          and the trigger is the one that must own the button element. */}
      <Tooltip content={hint} align="end" disabled={menu}>
        <DropdownMenuTrigger>{trigger}</DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent>
        <ViewRows items={items} activeId={active?.id} onApply={onApply} />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          // Nothing is narrowing the list, so there is no question to name.
          disabled={!Object.values(params).some((value) => value !== '')}
          onClick={() => {
            afterMenuClose(onSave);
          }}
        >
          Save what I am looking at…
        </DropdownMenuItem>
        {active ? <ViewAdminItems target={target} view={active} /> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The views menu + the column chooser, for a list toolbar.
 *
 * A saved view stores the QUESTION — filters, sort, columns — and never the rows
 * it produced, which is what makes "Running low at the warehouse" mean the same
 * thing in March as it did in January.
 */
export function SavedViewsBar({
  target,
  params,
  onApply,
  columns,
  visibleColumns,
  onColumnsChange,
  className,
  presentation = 'bar',
}: SavedViewsBarProps) {
  const invalidate = useInvalidateViews(target);
  const [saving, setSaving] = useState(false);

  return (
    <>
      <ViewsMenu
        target={target}
        params={params}
        onApply={onApply}
        presentation={presentation}
        className={className}
        onSave={() => {
          setSaving(true);
        }}
      />

      {columns && visibleColumns && onColumnsChange ? (
        <ColumnChooser
          columns={columns}
          visible={visibleColumns}
          onChange={onColumnsChange}
          presentation={presentation}
        />
      ) : null}

      <SaveViewDialog
        open={saving}
        onOpenChange={setSaving}
        target={target}
        params={params}
        visibleColumns={visibleColumns}
        onSaved={invalidate}
      />
    </>
  );
}

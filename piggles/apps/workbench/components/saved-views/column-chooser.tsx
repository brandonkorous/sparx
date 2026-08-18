'use client';

// Which columns a list shows.
//
// A menu of checkboxes rather than a drag-to-reorder panel: order is the list
// author's decision, and reordering it per user makes two people describing the
// same screen describe different screens. What varies is WHICH, not where.
//
// Columns ride in the saved view alongside the filters — a view called "What to
// chase up" that brings back the reorder point and the supplier is a different
// and more useful thing than one that only filters.

import {
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { faColumns3 } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { MENU_ROW, type ToolbarPresentation } from '../toolbar-presentation';
import type { ColumnOption } from './data';

export function ColumnChooser({
  columns,
  visible,
  onChange,
  presentation = 'bar',
}: {
  columns: ColumnOption[];
  visible: string[];
  onChange: (keys: string[]) => void;
  presentation?: ToolbarPresentation;
}) {
  const hiddenCount = columns.filter(
    (column) => !column.required && !visible.includes(column.key)
  ).length;
  const menu = presentation === 'menu';

  const hidden = hiddenCount > 0;
  const hint = hidden
    ? `Columns · showing ${String(columns.length - hiddenCount)} of ${String(columns.length)}`
    : 'Columns';

  // Bar: the same ghost square as Views, Refresh and Copy link — it stands beside
  // them and they only read as one group if they are one shape. Menu: a labelled
  // row, because a popover has no position to identify a control by.
  const trigger = menu ? (
    <Button
      size="sm"
      variant="ghost"
      className={MENU_ROW}
      {...(hidden ? { color: 'module' as const } : {})}
    >
      <Icon glyph={faColumns3} className="size-4" aria-hidden />
      <span>Columns</span>
      {hidden ? (
        // The label leads and the count trails, at the far edge of the row.
        <Badge color="module" variant="soft" size="sm" className="ml-auto">
          {columns.length - hiddenCount}/{columns.length}
        </Badge>
      ) : null}
    </Button>
  ) : (
    <Button
      size="sm"
      variant="ghost"
      shape="square"
      aria-label={hint}
      {...(hidden ? { color: 'module' as const } : {})}
    >
      <Icon glyph={faColumns3} className="size-4" aria-hidden />
    </Button>
  );

  return (
    <DropdownMenu>
      <Tooltip content={hint} align="end" disabled={menu}>
        <DropdownMenuTrigger>{trigger}</DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent>
        {columns.map((column) => {
          const shown = column.required === true || visible.includes(column.key);
          return (
            <DropdownMenuItem
              key={column.key}
              // The menu stays open: choosing columns is a handful of decisions
              // in a row, and closing after each one turns four clicks into twelve.
              closeOnClick={false}
              disabled={column.required === true}
              onClick={() => {
                if (column.required === true) return;
                onChange(
                  shown ? visible.filter((key) => key !== column.key) : [...visible, column.key]
                );
              }}
            >
              <Checkbox color="module" checked={shown} disabled={column.required === true} />
              <span className="flex-1 truncate">{column.label}</span>
              {column.required === true ? (
                <Badge color="info" variant="soft" size="sm">
                  Always
                </Badge>
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

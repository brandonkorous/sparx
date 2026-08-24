'use client';

// What you can do with the rows you have chosen.
//
// ── WHY IT STACKS ON THE TOOLBAR INSTEAD OF SITTING ABOVE IT ────────────────
//
// It used to appear in flow, which cost no height while nothing was chosen and
// pushed the whole table down 54px the moment something was — most of a row, at
// the exact moment a person is reaching for the NEXT checkbox. Tick one, aim at
// the next, hit the one above it. In a list whose bulk gesture is "tick several
// in a row" and whose last button is Delete, that is a real wrong row.
//
// So the strip is one grid cell with both things in it. The toolbar is always
// laid out — merely made invisible and `inert` while a selection is live — so
// the cell is always as tall as the toolbar needs, and choosing a row moves
// nothing at all. It costs the toolbar's height, which the pane was already
// paying.
//
// Hiding the toolbar is also honest rather than merely convenient: searching or
// changing a filter DISCARDS the selection, so those controls are the two that
// would undo what you are in the middle of. Paging keeps it, and paging lives at
// the other end of the pane.
//
// It says the COUNT rather than "selected items", because the number is the
// thing a person checks before pressing something irreversible.

import { Button, Text } from '@wizeworks/silicaui-react';
import type { ReactNode } from 'react';

function ChosenBar({
  summary,
  onClear,
  children,
}: {
  summary: string;
  onClear: () => void;
  children: ReactNode;
}) {
  return (
    <div className="bg-base-100 flex flex-wrap items-center gap-3 self-start rounded-lg p-2 shadow">
      <Text className="text-base">{summary}</Text>
      {/* Colorless on purpose: dismissing a selection is not a typed action, and
          it must not compete with the actions beside it. */}
      <Button className="ml-auto" size="sm" variant="ghost" onClick={onClear}>
        Clear
      </Button>
      {children}
    </div>
  );
}

export function BulkBar({
  count,
  /** "3 products chosen" — the caller words it, because only it knows the noun. */
  summary,
  onClear,
  /** The pane's own toolbar. It keeps its space while hidden, which is what
   *  makes choosing a row move nothing. */
  toolbar,
  children,
}: {
  count: number;
  summary: string;
  onClear: () => void;
  toolbar: ReactNode;
  /** The actions. Destructive last, and every one of them `color="danger"` if
   *  it destroys something — this bar is where a wrong press is most likely. */
  children: ReactNode;
}) {
  const chosen = count > 0;

  return (
    <div className="grid shrink-0 *:col-start-1 *:row-start-1">
      <div className={chosen ? 'invisible' : ''} inert={chosen} aria-hidden={chosen}>
        {toolbar}
      </div>
      {chosen ? (
        <ChosenBar summary={summary} onClear={onClear}>
          {children}
        </ChosenBar>
      ) : null}
    </div>
  );
}

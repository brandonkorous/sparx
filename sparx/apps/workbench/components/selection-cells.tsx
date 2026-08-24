'use client';

// The checkbox column, for any list that can choose several rows.
//
// Two rules that are easy to get wrong and expensive to get wrong:
//
//   1. A checkbox inside a clickable row must not also OPEN the row. Its click
//      and its Space key both stop at the cell.
//   2. The header box is indeterminate when some of the page is chosen, because
//      a plain unticked box beside four ticked rows reads as "nothing chosen".

import { Checkbox } from '@wizeworks/silicaui-react';

export function SelectAllCell({
  allChosen,
  someChosen,
  disabled,
  label,
  onToggle,
}: {
  allChosen: boolean;
  someChosen: boolean;
  disabled: boolean;
  /** Names what would be chosen — "every product here", not "all". */
  label: string;
  onToggle: () => void;
}) {
  return (
    <th className="w-0">
      <Checkbox
        color="module"
        aria-label={label}
        checked={allChosen}
        disabled={disabled}
        ref={(el) => {
          if (el) el.indeterminate = !allChosen && someChosen;
        }}
        onChange={onToggle}
      />
    </th>
  );
}

export function ChooseCell({
  checked,
  disabled,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onToggle: (on: boolean, modifiers: { shiftKey: boolean }) => void;
}) {
  return (
    <td
      className="w-0"
      onClick={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
      }}
    >
      <Checkbox
        color="module"
        aria-label={label}
        checked={checked}
        disabled={disabled ?? false}
        onChange={(event) => {
          // The native change event carries the modifier, so a shift-click
          // arrives here as one gesture rather than as a click plus a guess.
          const shiftKey = (event.nativeEvent as MouseEvent | undefined)?.shiftKey === true;
          onToggle(event.target.checked, { shiftKey });
        }}
      />
    </td>
  );
}

import type { KeyboardEvent, MouseEvent } from 'react';

/** True when the event started on one of the row's own controls. */
function fromControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('button,a,input') !== null;
}

/**
 * A table row that behaves like a button: click opens the document, Shift-click
 * opens it alongside, Enter and Space do the same from the keyboard.
 *
 * A press that landed on a control INSIDE the row belongs to that control. Without
 * this, Enter on the row's Delete opened the document behind the confirm dialog.
 */
export function rowOpenProps(
  id: string,
  onOpen: (id: string) => void,
  onOpenBeside: (id: string) => void
) {
  const open = (event: { shiftKey: boolean }) => {
    if (event.shiftKey) onOpenBeside(id);
    else onOpen(id);
  };

  return {
    className: 'cursor-pointer',
    tabIndex: 0,
    role: 'button' as const,
    onClick: (event: MouseEvent<HTMLTableRowElement>) => {
      if (fromControl(event.target)) return;
      open(event);
    },
    onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (fromControl(event.target)) return;
      event.preventDefault();
      open(event);
    },
  };
}

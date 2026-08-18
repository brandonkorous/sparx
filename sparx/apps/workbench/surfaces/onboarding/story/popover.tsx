'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './story.module.css';

// A lightweight anchored popover for the story's inline tokens: the trigger renders
// in place, the menu floats below it, and it closes on outside-click or Escape. The
// menu content receives a `close` callback so a selection dismisses it.
//
// Hand-rolled rather than a silica Dropdown because the trigger is an arbitrary inline
// word inside flowing prose (a chip, a ghost slot, a round "+"), not a button+caret —
// this owns only the open/close + anchoring, and the CSS module owns the look.
export function Popover({
  button,
  children,
}: {
  button: (props: { onClick: (e: React.MouseEvent) => void; expanded: boolean }) => ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className={styles.popover} ref={ref}>
      {button({
        onClick: (e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        },
        expanded: open,
      })}
      {open ? (
        <div className={styles.menu} role="menu">
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </span>
  );
}

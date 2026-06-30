'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './story.module.css';

// A lightweight anchored popover for the story's inline tokens: the trigger renders
// in place, the menu floats below it, and it closes on outside-click or Escape. The
// menu content receives a `close` callback so a selection dismisses it.
export function Popover({
  button,
  children,
  className,
}: {
  button: (props: { onClick: (e: React.MouseEvent) => void; expanded: boolean }) => ReactNode;
  children: (close: () => void) => ReactNode;
  className?: string;
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
    <span className={`${styles.popover}${className ? ` ${className}` : ''}`} ref={ref}>
      {button({
        onClick: (e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        },
        expanded: open,
      })}
      {open && (
        <div className={styles.menu} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </span>
  );
}

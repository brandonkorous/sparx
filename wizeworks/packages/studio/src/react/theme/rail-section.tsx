'use client';

// A titled block in the control rail.
//
// The icon sits INSIDE the heading rather than above it — a glyph and a label on
// separate lines is an eyebrow, and this pane has enough to say without one.

import type { ReactNode } from 'react';
import { StudioIcon } from '../icon';

export function RailSection({
  icon,
  title,
  hint,
  action,
  children,
}: {
  icon: string;
  title: string;
  hint?: string;
  /** One control belonging to the whole section, on the heading's own line. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-base-300 border-b px-4 py-5 last:border-b-0">
      <div className="flex items-center gap-2">
        <h3 className="text-base-content flex flex-1 items-center gap-2 text-lg font-semibold">
          <StudioIcon name={icon} className="text-primary text-xl" />
          {title}
        </h3>
        {action}
      </div>
      {hint ? <p className="text-base-content mt-1 mb-4 text-sm">{hint}</p> : null}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </section>
  );
}

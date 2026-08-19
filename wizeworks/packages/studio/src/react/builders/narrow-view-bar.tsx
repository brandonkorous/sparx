'use client';

// Which single column a narrow builder is showing.
//
// One bar, shared, because the page builder's and the email builder's were the same
// component down to the class strings — the only difference was the word in the
// middle, "Page" against "Email". Two copies of a control is two chances for one of
// them to be improved and the other not.
//
// A rail that only exists above a breakpoint would make the builder desktop-only,
// which the whole platform's rule says it isn't. So the columns are not hidden on a
// narrow builder, they are SWITCHED — and this is the switch.
//
// Container width, not viewport: a builder docked in a 500px pane on a wide monitor
// is exactly as narrow as one on a phone, and the toolbar above already measures
// itself the same way.

import { Button } from '@wizeworks/silicaui-react';
import { StudioIcon } from '../icon';

export interface NarrowViewOption<T extends string> {
  value: T;
  label: string;
  icon: string;
}

export function NarrowViewBar<T extends string>({
  views,
  view,
  onView,
}: {
  views: readonly NarrowViewOption<T>[];
  view: T;
  onView: (view: T) => void;
}) {
  return (
    <div className="border-base-300 flex shrink-0 items-center gap-1 border-t p-1 @5xl/builder:hidden">
      {views.map((option) => (
        <Button
          key={option.value}
          size="sm"
          className="flex-1"
          aria-pressed={view === option.value}
          {...(view === option.value ? { color: 'primary' as const } : {})}
          onClick={() => onView(option.value)}
        >
          <StudioIcon name={option.icon} className="inline-flex size-4" />
          {option.label}
        </Button>
      ))}
    </div>
  );
}

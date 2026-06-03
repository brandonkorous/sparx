'use client';

// Popover — Radix behavior, Surface appearance (docs/47 §11 B3). Radix
// (@radix-ui/react-popover) owns the trigger/positioning/dismiss; styling is
// `sf-*`. Compound parts (Trigger/Content/Close) attach + export.

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cx } from '../utils/cx';

function PopoverRoot(
  props: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Root>
): React.ReactElement {
  return <PopoverPrimitive.Root {...props} />;
}
PopoverRoot.displayName = 'Popover';

function PopoverContent({
  className,
  sideOffset = 8,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>): React.ReactElement {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        className={cx('sf-popover', className)}
        sideOffset={sideOffset}
        {...props}
      >
        {children}
        <PopoverPrimitive.Arrow className="sf-popover__arrow" />
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}
PopoverContent.displayName = 'PopoverContent';

const Popover = Object.assign(PopoverRoot, {
  Trigger: PopoverPrimitive.Trigger,
  Close: PopoverPrimitive.Close,
  Content: PopoverContent,
});

export { Popover, PopoverContent };

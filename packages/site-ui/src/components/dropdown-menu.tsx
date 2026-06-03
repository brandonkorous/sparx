'use client';

// DropdownMenu — Radix behavior, Surface appearance (docs/47 §11 B3). Radix
// (@radix-ui/react-dropdown-menu) owns the trigger/focus/typeahead/positioning;
// styling is `sf-*`. Compound parts (Trigger/Content/Item/Separator/Label) attach +
// export. The menu surface dogfoods the shared `surface` color via its CSS.

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cx } from '../utils/cx';

function DropdownMenuRoot(
  props: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Root>
): React.ReactElement {
  return <DropdownMenuPrimitive.Root {...props} />;
}
DropdownMenuRoot.displayName = 'DropdownMenu';

function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>): React.ReactElement {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        className={cx('sf-dropdown', className)}
        sideOffset={sideOffset}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}
DropdownMenuContent.displayName = 'DropdownMenuContent';

function DropdownMenuItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>): React.ReactElement {
  return <DropdownMenuPrimitive.Item className={cx('sf-dropdown__item', className)} {...props} />;
}
DropdownMenuItem.displayName = 'DropdownMenuItem';

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>): React.ReactElement {
  return <DropdownMenuPrimitive.Label className={cx('sf-dropdown__label', className)} {...props} />;
}
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>): React.ReactElement {
  return (
    <DropdownMenuPrimitive.Separator
      className={cx('sf-dropdown__separator', className)}
      {...props}
    />
  );
}
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

const DropdownMenu = Object.assign(DropdownMenuRoot, {
  Trigger: DropdownMenuPrimitive.Trigger,
  Content: DropdownMenuContent,
  Item: DropdownMenuItem,
  Label: DropdownMenuLabel,
  Separator: DropdownMenuSeparator,
});

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
};

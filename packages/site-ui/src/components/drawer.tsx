'use client';

// Drawer — an off-canvas side sheet (docs/47 §11 B3). Reuses the Radix Dialog
// primitive (focus trap, scroll lock, ESC/overlay close) with a `side` that slides
// the panel in from an edge; styling is `sf-*`. Its own root wrapper keeps it
// independent of Dialog (no shared primitive mutation). Compound parts attach +
// export.

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cx } from '../utils/cx';

export type DrawerSide = 'left' | 'right' | 'top' | 'bottom';

function DrawerRoot(
  props: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>
): React.ReactElement {
  return <DialogPrimitive.Root {...props} />;
}
DrawerRoot.displayName = 'Drawer';

export interface DrawerContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  /** Edge the panel slides in from. Defaults to `right`. */
  side?: DrawerSide;
  /** Class for the backdrop overlay. */
  overlayClassName?: string;
}

function DrawerContent({
  side = 'right',
  className,
  overlayClassName,
  children,
  ...props
}: DrawerContentProps): React.ReactElement {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={cx('sf-drawer__overlay', overlayClassName)} />
      <DialogPrimitive.Content
        className={cx('sf-drawer', `sf-drawer--${side}`, className)}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
DrawerContent.displayName = 'DrawerContent';

function DrawerTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>): React.ReactElement {
  return <DialogPrimitive.Title className={cx('sf-drawer__title', className)} {...props} />;
}
DrawerTitle.displayName = 'DrawerTitle';

const Drawer = Object.assign(DrawerRoot, {
  Trigger: DialogPrimitive.Trigger,
  Close: DialogPrimitive.Close,
  Content: DrawerContent,
  Title: DrawerTitle,
});

export { Drawer, DrawerContent, DrawerTitle };

'use client';

// Dialog (Modal) — Radix behavior, Surface appearance (docs/47 §11 B3). Radix
// (@radix-ui/react-dialog) owns focus trap, scroll lock, ESC/overlay close, and
// portalling; styling is `st-*`. `placement` positions the panel (top · center ·
// bottom). The root is a thin wrapper (NOT a mutated primitive, so Drawer can reuse
// the same primitive independently). Compound parts attach + export.

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cx } from '../utils/cx';

export type DialogPlacement = 'top' | 'center' | 'bottom';

function DialogRoot(
  props: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>
): React.ReactElement {
  return <DialogPrimitive.Root {...props} />;
}
DialogRoot.displayName = 'Dialog';

export interface DialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  /** Panel placement. Defaults to `center`. */
  placement?: DialogPlacement;
  /** Class for the backdrop overlay. */
  overlayClassName?: string;
}

function DialogContent({
  placement = 'center',
  className,
  overlayClassName,
  children,
  ...props
}: DialogContentProps): React.ReactElement {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={cx('st-dialog__overlay', overlayClassName)} />
      <DialogPrimitive.Content
        className={cx('st-dialog', `st-dialog--${placement}`, className)}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
DialogContent.displayName = 'DialogContent';

function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>): React.ReactElement {
  return <DialogPrimitive.Title className={cx('st-dialog__title', className)} {...props} />;
}
DialogTitle.displayName = 'DialogTitle';

function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>): React.ReactElement {
  return <DialogPrimitive.Description className={cx('st-dialog__desc', className)} {...props} />;
}
DialogDescription.displayName = 'DialogDescription';

const Dialog = Object.assign(DialogRoot, {
  Trigger: DialogPrimitive.Trigger,
  Close: DialogPrimitive.Close,
  Content: DialogContent,
  Title: DialogTitle,
  Description: DialogDescription,
});

export { Dialog, DialogContent, DialogTitle, DialogDescription };

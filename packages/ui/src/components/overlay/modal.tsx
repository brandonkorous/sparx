'use client';

import * as React from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent as SilicaDialogContent,
  DialogDescription as SilicaDialogDescription,
  DialogTitle as SilicaDialogTitle,
  DialogTrigger,
} from '@wizeworks/silicaui-react';
import { X } from 'lucide-react';
import { cva, type VariantProps } from '../../utils/cva';
import { cn } from '../../utils/cn';

// Doc 23 §9 names this "Modal" — built on silicaui's Dialog (Base UI: focus
// trap, scroll lock, dismissal) rather than raw Radix, so it now coordinates
// correctly with every OTHER silica popover (DropdownMenu, Select, …) nested
// inside it. Radix's own Dialog marks everything outside its own portal
// inert while open, including a Base UI popup's separately-portaled root —
// that silently broke exactly that pairing (see `ViewSwitcher` in the
// dashboard's detail-panel.tsx, which had to fall back to a Radix
// DropdownMenu until this migration landed).
//
// Names stay the same as the pre-migration Radix version, but two Base UI
// API differences DID require call-site updates (not a pure drop-in):
//   - `ModalTrigger`/`ModalClose` always treat their single child as the
//     interactive element — no `asChild` prop (it's implicit, drop it).
//   - Outside-dismiss and initial-focus are ROOT-level / Content-level
//     PROPS now (`disablePointerDismissal` on `Modal`, `initialFocus` on
//     `ModalContent`), not Radix's per-event `onInteractOutside` /
//     `onOpenAutoFocus` callbacks.

export const Modal = Dialog;
export const ModalTrigger = DialogTrigger;
export const ModalClose = DialogClose;
// No consumer actually portals through this (verified before migrating) —
// kept only so the export surface doesn't shrink. Base UI's Dialog manages
// its own portal internally and doesn't expose one to re-target.
export function ModalPortal({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

const modalContentVariants = cva(['max-h-[85vh] w-full overflow-y-auto p-6'], {
  variants: {
    size: {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-2xl',
      '2xl': 'max-w-4xl',
    },
  },
  defaultVariants: { size: 'md' },
});

// Below `md`, anchor the panel to the bottom as a near-full-height sheet
// (thumb-reachable, no dead side gutters) instead of a small centered dialog.
// `[transform:none]` cancels silica's OWN `.dialog-popup` centering — that's
// a hardcoded CSS-in-JS property on silica's plugin class, not a Tailwind
// utility, so a plain `translate-x/y-0` utility (which targets Tailwind v4's
// separate `translate` CSS property) would stack on top of it rather than
// replacing it. Targeting `transform` directly, as an arbitrary property, is
// the only override that actually lands — and it wins on specificity because
// Tailwind's utilities layer always cascades after the components layer
// silica's plugin classes live in. Opt-in via `mobileSheet`.
const MOBILE_SHEET =
  'max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:[transform:none] max-md:h-[92dvh] max-md:max-h-none max-md:w-full max-md:max-w-none max-md:rounded-b-none max-md:rounded-t-2xl';

export interface ModalContentProps
  extends
    Omit<React.ComponentPropsWithoutRef<typeof SilicaDialogContent>, 'children'>,
    VariantProps<typeof modalContentVariants> {
  children?: React.ReactNode;
  /** Hide the built-in close (X) button in the top-right. */
  hideClose?: boolean;
  /** Below `md`, render as a bottom-anchored full-height sheet. Default false. */
  mobileSheet?: boolean;
}

export function ModalContent({
  className,
  size,
  hideClose = false,
  mobileSheet = false,
  children,
  ...props
}: ModalContentProps) {
  return (
    <SilicaDialogContent
      className={cn(modalContentVariants({ size }), mobileSheet && MOBILE_SHEET, className)}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogClose>
          <button
            type="button"
            aria-label="Close"
            className={cn(
              'absolute top-3 right-3 rounded-md p-1',
              'hover:bg-base-200',
              'transition-colors duration-150',
              'focus-ring'
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </DialogClose>
      )}
    </SilicaDialogContent>
  );
}

export const ModalHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mb-4 flex flex-col gap-1.5 pr-8', className)} {...props} />
);
ModalHeader.displayName = 'ModalHeader';

export const ModalFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2',
      className
    )}
    {...props}
  />
);
ModalFooter.displayName = 'ModalFooter';

export function ModalTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SilicaDialogTitle>) {
  return (
    <SilicaDialogTitle className={cn('text-lg leading-tight font-medium', className)} {...props} />
  );
}

export function ModalDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SilicaDialogDescription>) {
  return <SilicaDialogDescription className={cn('text-sm', className)} {...props} />;
}

export { modalContentVariants };

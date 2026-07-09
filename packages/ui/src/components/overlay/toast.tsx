'use client';

import * as React from 'react';
import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner';

// Wraps sonner with sparx tokens. Apps mount <Toaster /> once at the root and
// fire toasts via `toast.success(...)`, `toast.error(...)`, etc.

export const Toaster = (
  props: React.ComponentPropsWithoutRef<typeof SonnerToaster>
): React.ReactElement => (
  <SonnerToaster
    position="bottom-right"
    closeButton
    toastOptions={{
      classNames: {
        toast:
          'group rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-100)] text-base-content shadow-md',
        title: 'text-sm font-medium',
        description: 'text-xs text-base-content/70',
        actionButton:
          'rounded-md bg-[var(--color-primary)] px-2 py-1 text-xs font-medium text-white hover:bg-[var(--color-primary)]',
        cancelButton:
          'rounded-md border border-[var(--color-base-300)] bg-[var(--color-base-100)] px-2 py-1 text-xs text-base-content/70 hover:bg-[var(--color-base-200)]',
        success: 'border-[var(--color-success)] text-success bg-success bg-soft',
        error: 'border-[var(--color-danger)] text-danger bg-danger bg-soft',
        warning: 'border-[var(--color-warning)] text-warning bg-warning bg-soft',
      },
    }}
    {...props}
  />
);

// Re-export sonner's `toast` so consumers do `import { toast } from '@sparx/ui'`.
export const toast = sonnerToast;

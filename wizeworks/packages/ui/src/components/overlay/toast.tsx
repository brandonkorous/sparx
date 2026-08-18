'use client';

import * as React from 'react';
import { Toast } from '@base-ui/react/toast';
import { ToastProvider } from '@wizeworks/silicaui-react';

// Wraps silicaui's Toast (Base UI underneath) with a sonner-shaped API so the
// ~150 existing call sites (`toast.success(...)`, bare `toast(msg, opts)`)
// don't change. `createToastManager()` is Base UI's event-bus escape hatch for
// firing toasts from outside a React render — exactly the "call from
// anywhere" ergonomics the old sonner singleton gave us. Apps mount
// `<Toaster />` once (a leaf, like before — it doesn't need to wrap children)
// and fire toasts via `toast.success(...)` etc. from anywhere, hook or not.
const manager = Toast.createToastManager();

interface ToastOptions {
  description?: React.ReactNode;
  /** Ms before auto-dismiss. `Infinity` means "never" (mapped to Base UI's `0` sentinel). */
  duration?: number;
  /** Dedupes/replaces an in-flight toast sharing this id. */
  id?: string;
  action?: { label: string; onClick: () => void };
}

type ToastType = 'success' | 'error' | 'warning' | 'info' | undefined;

function toBaseUiTimeout(duration: number | undefined): number | undefined {
  if (duration === undefined) return undefined;
  return duration === Number.POSITIVE_INFINITY ? 0 : duration;
}

function add(type: ToastType, title: React.ReactNode, opts?: ToastOptions): string {
  return manager.add({
    id: opts?.id,
    title,
    description: opts?.description,
    type,
    timeout: toBaseUiTimeout(opts?.duration),
    actionProps: opts?.action
      ? { children: opts.action.label, onClick: opts.action.onClick }
      : undefined,
  });
}

function toastFn(title: React.ReactNode, opts?: ToastOptions): string {
  return add(undefined, title, opts);
}

export const toast = Object.assign(toastFn, {
  success: (title: React.ReactNode, opts?: ToastOptions) => add('success', title, opts),
  error: (title: React.ReactNode, opts?: ToastOptions) => add('error', title, opts),
  warning: (title: React.ReactNode, opts?: ToastOptions) => add('warning', title, opts),
  info: (title: React.ReactNode, opts?: ToastOptions) => add('info', title, opts),
  message: (title: React.ReactNode, opts?: ToastOptions) => add(undefined, title, opts),
  promise: manager.promise,
  close: (id: string) => manager.close(id),
});

export const Toaster = (): React.ReactElement => <ToastProvider toastManager={manager} />;

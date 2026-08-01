'use client';

// Imperative confirm dialog. Mount <ConfirmProvider> once near the app root
// (next to <Toaster />), then any client component can do
//
//   const confirm = useConfirm();
//   const ok = await confirm({ title: '…', description: '…', color: 'danger' });
//   if (!ok) return;
//
// instead of `window.confirm(...)`.
//
// The DIALOG is silicaui's — `ImperativeAlertDialogProvider` renders the single
// shared alert dialog and `useImperativeAlertDialog` is the promise-returning
// hook. This file used to render its own Radix AlertDialog and paint the
// confirm button with `buttonClasses({ color: tone })`; both are gone. What
// stays here are the two sparx decisions silica has no opinion on:
//
//  1. The continuation runs OUTSIDE the dialog's close commit (see below).
//  2. A confirm defaults to `danger`, because on this platform a confirm
//     guards a destructive action unless it says otherwise.
//
// Everything else — the surface, the inert backdrop, focus handling, the
// button's resolved ink — comes from silica, so a token change moves it.

import * as React from 'react';
import {
  ImperativeAlertDialogProvider,
  useImperativeAlertDialog,
  type ConfirmOptions as SilicaConfirmOptions,
} from '@wizeworks/silicaui-react';

/** Options accepted by {@link useConfirm}. `color` takes any registered silica
 *  color, so a confirm is not limited to a fixed three-tone enum — a reversible
 *  disruption can be `warning`, a neutral commit the active `module` hue. */
export type ConfirmOptions = SilicaConfirmOptions;

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  return <ImperativeAlertDialogProvider>{children}</ImperativeAlertDialogProvider>;
}

export function useConfirm(): ConfirmFn {
  const confirm = useImperativeAlertDialog();

  return React.useCallback(
    async (options: ConfirmOptions) => {
      const confirmed = await confirm({ color: 'danger', ...options });

      // silica resolves the promise synchronously inside the dialog's own close
      // commit (a flushSync). A caller that then fires a `mutate()` or a
      // `toast()` in the same continuation lands that work INSIDE the commit,
      // which React rejects: "flushSync was called from inside a lifecycle
      // method." The dialog still works, but it is the class of bug that
      // eventually drops an update rather than only warning.
      //
      // Yielding one macrotask puts the caller's continuation in a fresh task.
      // It costs a frame nobody perceives and makes the interaction legal.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      return confirmed;
    },
    [confirm]
  );
}

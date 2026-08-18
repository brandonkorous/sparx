'use client';

// A confirm dialog that yields before it hands control back.
//
// silicaui's `useImperativeAlertDialog` resolves its promise synchronously inside
// the dialog's own close commit (a flushSync). A caller that then fires a
// `mutate()` / `toast()` in the same continuation lands that work INSIDE the
// commit, which React rejects: "flushSync was called from inside a lifecycle
// method." The dialog still works, but the warning is real and the pattern is the
// kind that eventually drops an update rather than only warning.
//
// This wraps the imperative confirm so the caller's continuation runs one
// macrotask later — outside the commit — exactly as `afterPaneChange` /
// `afterMenuClose` do for toasts and menu-opened overlays. It is a drop-in for
// `useImperativeAlertDialog`: same call shape, same boolean result, so a surface
// swaps the hook and changes nothing else.

import { useImperativeAlertDialog } from '@wizeworks/silicaui-react';
import { deferTick } from './defer';

type ConfirmFn = ReturnType<typeof useImperativeAlertDialog>;

export function useConfirm(): ConfirmFn {
  const confirm = useImperativeAlertDialog();
  return async (options: Parameters<ConfirmFn>[0]): Promise<Awaited<ReturnType<ConfirmFn>>> => {
    const confirmed = await confirm(options);
    // Leave the dialog's flushSync commit before returning, so whatever the caller
    // does next (a mutate, a toast, a pane close) is a fresh task, not a nested one.
    await deferTick();
    return confirmed;
  };
}

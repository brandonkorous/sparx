'use client';

import * as React from 'react';

import { useConfirm } from '@sparx/ui';

// Unsaved-changes guard for form surfaces in the detail overlay (docs/86 +
// docs/105 platform gap). A form on `SurfaceFrame` can hold unsaved edits, but
// the ways OUT of it live in different component trees: the frame-owned Cancel
// (the form itself), and the host chrome's Close / Switch / backdrop-Esc (the
// detail-panel). Without a shared channel, any of them silently discards edits.
//
// This is that channel. The active form registers ONE "is it safe to leave?"
// guard (it owns the dirty check + the confirm dialog, via `useConfirm`); every
// leave path routes through `useLeaveGuard()` and only proceeds when the guard
// resolves `true`. One source of truth, wired once here instead of per page.
//
// Scope: the provider wraps the drawer/modal body (both the host chrome and the
// slot-rendered form), so all overlay leave paths are covered. The full-page
// `embedded` route has no host chrome and no provider — there the form's own
// Cancel still guards (it calls its registered guard directly), and browser
// navigation is the OS's concern.

/** Returns `true` when it's safe to leave (not dirty, or the user confirmed the
 *  discard); `false` to block the leave. */
export type LeaveGuard = () => Promise<boolean> | boolean;

interface GuardChannel {
  /** The active form registers its guard here (null to clear on unmount). */
  register: (guard: LeaveGuard | null) => void;
  /** Leave paths call this; awaits the registered guard (true if none). */
  run: LeaveGuard;
}

const GuardContext = React.createContext<GuardChannel | null>(null);

export function UnsavedGuardProvider({ children }: { children: React.ReactNode }) {
  const guardRef = React.useRef<LeaveGuard | null>(null);
  const register = React.useCallback((guard: LeaveGuard | null) => {
    guardRef.current = guard;
  }, []);
  const run = React.useCallback<LeaveGuard>(
    () => (guardRef.current ? guardRef.current() : true),
    []
  );
  const value = React.useMemo<GuardChannel>(() => ({ register, run }), [register, run]);
  return <GuardContext.Provider value={value}>{children}</GuardContext.Provider>;
}

/** Form hook: register the leave guard for as long as this form is mounted.
 *  Pass a STABLE callback (wrap in `useCallback`) — it re-registers whenever the
 *  guard identity changes (e.g. when `dirty` flips) and clears on unmount. */
export function useRegisterLeaveGuard(guard: LeaveGuard): void {
  const channel = React.useContext(GuardContext);
  React.useEffect(() => {
    channel?.register(guard);
    return () => channel?.register(null);
  }, [channel, guard]);
}

/** Host hook: the guard to run before any leave path (Close / Switch / Cancel /
 *  backdrop). Resolves `true` when there's no provider, so callers stay simple. */
export function useLeaveGuard(): LeaveGuard {
  const channel = React.useContext(GuardContext);
  return channel?.run ?? (() => true);
}

/** Discard-dialog copy. Pass `{ kind: 'create', noun }` / `{ kind: 'edit', noun? }`
 *  for the house wording, or a full `{ title, description, confirmLabel? }` to
 *  override. The `noun` is the entity, lower-case ("category", "discount"). */
export type DiscardCopy =
  | { kind: 'create'; noun: string }
  | { kind: 'edit'; noun?: string }
  | { title: string; description: string; confirmLabel?: string };

function resolveDiscardCopy(copy: DiscardCopy): {
  title: string;
  description: string;
  confirmLabel: string;
} {
  if ('kind' in copy) {
    if (copy.kind === 'create') {
      return {
        title: `Discard new ${copy.noun}?`,
        description: `You haven’t created this ${copy.noun} yet. Leaving now will discard what you’ve entered.`,
        confirmLabel: 'Discard',
      };
    }
    return {
      title: 'Discard unsaved changes?',
      description: copy.noun
        ? `Your edits to this ${copy.noun} haven’t been saved. Leaving now will discard them.`
        : 'Your changes haven’t been saved. Leaving now will discard them.',
      confirmLabel: 'Discard changes',
    };
  }
  return {
    title: copy.title,
    description: copy.description,
    confirmLabel: copy.confirmLabel ?? 'Discard changes',
  };
}

/** Form hook: wire the unsaved-changes guard in ONE call. Compute `dirty`, pass
 *  it + the discard copy, and this (a) registers the leave guard so the overlay
 *  host's Close / Switch / backdrop consult it, and (b) returns `guardLeave` for
 *  the form's own Cancel:
 *
 *      const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'category' });
 *      const cancel = async () => { if (await guardLeave()) close(); };
 *
 *  Routes the success path (a completed create/save is NOT a discard) through the
 *  UNGUARDED `close`, never through the guarded Cancel — else it false-prompts. */
export function useUnsavedGuard(dirty: boolean, copy: DiscardCopy): LeaveGuard {
  const confirm = useConfirm();
  const { title, description, confirmLabel } = resolveDiscardCopy(copy);
  const guardLeave = React.useCallback<LeaveGuard>(async () => {
    if (!dirty) return true;
    return confirm({ title, description, confirmLabel, tone: 'danger' });
  }, [dirty, confirm, title, description, confirmLabel]);
  useRegisterLeaveGuard(guardLeave);
  return guardLeave;
}

'use client';

// "Link to me as THIS instead" — how a pane that has no address of its own gets
// one without changing what it is.
//
// ── THE PROBLEM ─────────────────────────────────────────────────────────────
//
// A pane's address is built from its descriptor (lib/workbench/address.ts), and
// that is right for almost every pane: the descriptor is what a link has to
// reconstruct. But a FOLLOWING pane — one that tracks a selection rather than
// naming a record (see surfaces/commerce/product-scope.tsx) — deliberately has
// no record in its params, so `buildPath` returns null, the copy-link control
// hides, and the one thing a person wants to hand a colleague ("this, what I am
// looking at") is the one thing they cannot send.
//
// Writing the record into the descriptor would fix the link and break the pane:
// a facet pane with `productId` in its params IS a pinned pane, and pinning is
// exactly what a following pane must not do to itself.
//
// ── THE SEAM ────────────────────────────────────────────────────────────────
//
// So a surface may DECLARE the params a link to it should use, without those
// params becoming its identity. The descriptor is untouched, the pane keeps
// following, and only the copied address is pinned. Keyed by pane id, held
// outside React so the tab bar — which renders outside the pane's subtree — can
// read it, and withdrawn on unmount so a closed pane leaves nothing behind.
//
// Nothing about this is product-shaped: a pane that follows the selected
// customer declares `{ customerId }` and gets the same behaviour with no edit
// here or in copy-pane-link.tsx.
//
// Everything that turns a pane into a link goes through `usePaneLink`, so the
// toolbar button, the overflow row and the tab context menu all read this — two
// implementations producing two links for one pane is the thing that hook's doc
// comment exists to prevent.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { SurfaceParams } from '../surfaces/descriptor';
import { usePaneId } from './pane-identity';

const shareAs = new Map<string, SurfaceParams>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stable across renders for equal params, so the registering effect re-runs
 *  only when the values actually change. */
function fingerprint(params: SurfaceParams): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key] ?? ''}`)
    .join('&');
}

function register(paneId: string, params: SurfaceParams): void {
  const existing = shareAs.get(paneId);
  if (existing && fingerprint(existing) === fingerprint(params)) return;
  shareAs.set(paneId, params);
  emit();
}

function withdraw(paneId: string, params: SurfaceParams): void {
  // Only clear what we put there. A cleanup running after the pane has already
  // registered a newer set — a re-mount, a fast selection change — would
  // otherwise blank a live registration and the link would vanish mid-use.
  if (shareAs.get(paneId) !== params) return;
  shareAs.delete(paneId);
  emit();
}

/**
 * Declares the params a link to THIS pane should carry.
 *
 * ```tsx
 * // A pane following the current product still copies a link that pins it.
 * useShareAs(isFollowing && productId ? { ...ctx.params, productId } : null);
 * ```
 *
 * Pass null when there is nothing to point at — the pane falls back to its
 * descriptor, which for a following pane means no link at all, which is the
 * honest answer. Call it unconditionally: it is a hook, and a pane's state
 * changes underneath it.
 */
export function useShareAs(params: SurfaceParams | null): void {
  const paneId = usePaneId();
  const key = params ? fingerprint(params) : null;
  // The effect reads the CURRENT object rather than closing over the one from
  // the render that scheduled it, so an unchanged fingerprint never re-registers
  // and a changed one always registers the values on screen.
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    const current = paramsRef.current;
    if (!paneId || !current) return;
    register(paneId, current);
    return () => {
      withdraw(paneId, current);
    };
  }, [paneId, key]);
}

/**
 * The params a pane has declared for links to it, or null when it has none.
 *
 * Read by `usePaneLink` and nothing else — a second reader would be a second
 * place the answer could differ.
 */
export function useShareAsParams(paneId: string | null): SurfaceParams | null {
  return useSyncExternalStore(
    subscribe,
    () => (paneId ? (shareAs.get(paneId) ?? null) : null),
    () => null
  );
}

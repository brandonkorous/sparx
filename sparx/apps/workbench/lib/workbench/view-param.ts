'use client';

// A pane's tab, held in the pane's own address (persona issue 374).
//
// A tab used to be `useState` and nothing else, so a reload, a copied link and
// a restored workspace all came back on the first tab, and a link that named a
// tab opened a SECOND copy of a record already open on another one. The tab now
// lives in the pane's params as a declared view param (`viewParams` on the
// surface): the address bar shows it, the saved layout keeps it, and opening the
// same record again moves the open pane to the tab asked for.
//
// The address is the only copy. There is no local state to fall out of step
// with it, which is the failure a "remember the last tab" in browser storage
// would have had: a pane that looks addressed while the link it gives out opens
// somewhere else.

import { useCallback, useMemo } from 'react';
import type { SurfaceContext } from '../surfaces/registry';

/**
 * The value of one view param, and a setter for it.
 *
 * `allowed` is what the pane can show right now. A value outside it (an old
 * link to a tab that has since gone, a language the record no longer has) reads
 * as `fallback`. Setting the fallback REMOVES the param, so the default view
 * keeps the plain address everyone already has.
 */
export function useViewParam<T extends string>(
  ctx: SurfaceContext,
  name: string,
  allowed: readonly T[],
  fallback: T
): [T, (next: string) => void] {
  const raw = ctx.params[name];
  const value =
    raw !== undefined && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
  const set = useCallback(
    (next: string) => {
      ctx.setViewParams({ [name]: next === fallback ? null : next });
    },
    [ctx, name, fallback]
  );
  return [value, set];
}

/** One view param handed to a component that has no ctx of its own: the raw
 *  value in the address (undefined when absent) and a setter. Null removes it. */
export interface ViewParamHandle {
  readonly value: string | undefined;
  readonly set: (next: string | null) => void;
}

/** A `ViewParamHandle` for one of this pane's declared view params. */
export function useViewParamHandle(ctx: SurfaceContext, name: string): ViewParamHandle {
  const value = ctx.params[name];
  const set = useCallback(
    (next: string | null) => {
      ctx.setViewParams({ [name]: next });
    },
    [ctx, name]
  );
  return useMemo(() => ({ value, set }), [value, set]);
}

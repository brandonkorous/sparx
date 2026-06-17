'use client';

import * as React from 'react';
import { cx } from '../utils/cx';
import { siteProgress } from './top-progress-controller';

// Storefront page-top loading bar. Springs in on a navigation, trickles toward
// a cap, then snaps to 100% and fades when the route commits. The fill reveals a
// light→base→deep sweep of the TENANT's brand (--st-primary) sized to the
// viewport, so it reads as the merchant's own — not sparx's. The app feeds the
// route via the `route` prop (it owns usePathname()), keeping this component
// router-agnostic. Styling is the semantic `.st-topbar*` classes (styles/
// top-progress.css); only the dynamic width/opacity are inline.

export interface TopProgressProps {
  /** Current route key — pass `usePathname()`. When it changes, the in-flight
   *  navigation completes. */
  route?: string;
  /** Bar thickness in px (default 3). */
  height?: number;
  /** Stacking order (default 1600 — above site chrome). */
  zIndex?: number;
  /** Install anchor/history navigation listeners (default true). Set false to
   *  drive the bar purely through the imperative `siteProgress` API. */
  intercept?: boolean;
}

function isModifiedClick(e: MouseEvent): boolean {
  return e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
}

function anchorFrom(target: EventTarget | null): HTMLAnchorElement | null {
  let node = target as Node | null;
  while (node && node.nodeType !== 1) node = node.parentNode;
  const el = node as Element | null;
  return el?.closest?.('a') ?? null;
}

let historyPatched = false;
let activeStart: (() => void) | null = null;

/** Detect navigation start (in-app anchor clicks, back/forward, programmatic
 *  history changes) and call `onStart`. Pure DOM — no router coupling. */
function installNavStart(onStart: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const onClick = (e: MouseEvent): void => {
    if (isModifiedClick(e) || e.defaultPrevented) return;
    const a = anchorFrom(e.target);
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || a.target === '_blank' || a.hasAttribute('download')) return;
    if (a.origin !== window.location.origin) return;
    if (a.pathname === window.location.pathname) return;
    onStart();
  };
  const onPop = (): void => onStart();

  document.addEventListener('click', onClick, { capture: true });
  window.addEventListener('popstate', onPop);
  activeStart = onStart;

  if (!historyPatched && typeof history !== 'undefined') {
    historyPatched = true;
    (['pushState', 'replaceState'] as const).forEach((key) => {
      const original = history[key];
      history[key] = function patched(
        this: History,
        ...args: Parameters<History['pushState']>
      ): void {
        const before = window.location.pathname;
        original.apply(this, args);
        const url = args[2];
        if (url == null) return;
        if (new URL(String(url), window.location.href).pathname === before) return;
        // Defer to a microtask: App Router calls `pushState` from inside a
        // commit-phase (insertion) effect, and notifying the
        // `useSyncExternalStore` bar synchronously there throws
        // "useInsertionEffect must not schedule updates." A microtask runs
        // after the commit unwinds, so the bar still starts immediately.
        queueMicrotask(() => activeStart?.());
      };
    });
  }

  return () => {
    document.removeEventListener('click', onClick, { capture: true });
    window.removeEventListener('popstate', onPop);
    if (activeStart === onStart) activeStart = null;
  };
}

export function TopProgress({
  route,
  height = 3,
  zIndex = 1600,
  intercept = true,
}: TopProgressProps): React.ReactElement {
  const state = React.useSyncExternalStore(
    siteProgress.subscribe,
    siteProgress.getState,
    siteProgress.getServerState
  );

  React.useEffect(() => {
    if (!intercept) return;
    return installNavStart(() => siteProgress.startRoute());
  }, [intercept]);

  const mounted = React.useRef(false);
  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    siteProgress.endRoute();
  }, [route]);

  const visible = state.active && !state.fading;
  const pct = Math.round(state.value * 1000) / 10;

  return (
    <div aria-hidden className={cx('st-topbar')} style={{ zIndex }}>
      <div
        className="st-topbar__bar"
        style={{
          height,
          width: `${pct}%`,
          opacity: visible ? 1 : 0,
          transition: state.active ? 'width 200ms linear, opacity 320ms ease' : 'none',
        }}
      >
        <div className="st-topbar__peg" style={{ opacity: visible ? 1 : 0 }} />
      </div>
    </div>
  );
}
TopProgress.displayName = 'TopProgress';

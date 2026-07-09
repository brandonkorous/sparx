'use client';

import * as React from 'react';
import { cn } from '../../utils/cn';
import { topProgress } from './top-progress-controller';
import { installNavigationListeners, resolveRouteModule } from './top-progress-nav';

// TopProgress — the page-top loading bar (GitHub-style). It springs in on a
// navigation, trickles toward a cap, then snaps to 100% and fades when the
// route commits. The fill REVEALS a gradient sized to the viewport, so progress
// literally moves through the brand: at platform scope that's the full module
// spectrum (identity = all modules); inside a module it's a sweep of that
// module's color. Both are token-driven (tokens.css `.sx-topbar*`).
//
// The bar reads route from the `route` prop (the app passes `usePathname()`),
// so this component stays Next-agnostic. It also exposes the imperative
// `topProgress` API for non-navigation work (saves, long fetches).

export interface TopProgressProps {
  /** Current route key — pass `usePathname()`. When it changes, the in-flight
   *  navigation completes. Required for App Router route tracking. */
  route?: string;
  /** Bar thickness in px (default 3). */
  height?: number;
  /** Stacking order (default 1600 — above app chrome). */
  zIndex?: number;
  /** Install anchor/history navigation listeners (default true). Set false to
   *  drive the bar purely through the imperative `topProgress` API. */
  intercept?: boolean;
}

export function TopProgress({
  route,
  height = 3,
  zIndex = 1600,
  intercept = true,
}: TopProgressProps) {
  const state = React.useSyncExternalStore(
    topProgress.subscribe,
    topProgress.getState,
    topProgress.getServerState
  );

  // Navigation start → run the route job, tinted to the destination module.
  React.useEffect(() => {
    if (!intercept) return;
    return installNavigationListeners((module) => topProgress.startRoute(module));
  }, [intercept]);

  // Route committed → finish the route job. Skip the initial mount so the bar
  // doesn't fire on first paint.
  const mounted = React.useRef(false);
  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    topProgress.endRoute();
  }, [route]);

  // The in-flight destination wins; otherwise fall back to the current route's
  // module (so a mutation on a module page wears that module's color).
  const module = state.module ?? resolveRouteModule(route);
  const inModule = module != null;

  const style: React.CSSProperties = { zIndex };
  if (inModule) {
    // Point the bar's --color-module at the resolved module's silica token, since
    // the bar mounts at the app root (outside any ModuleProvider subtree).
    (style as Record<string, string>)['--color-module'] = `var(--color-module-${module})`;
  }

  const visible = state.active && !state.fading;
  const pct = Math.round(state.value * 1000) / 10;

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0',
        inModule ? 'sx-topbar--module' : 'sx-topbar--spectrum'
      )}
      style={style}
    >
      <div
        className="sx-topbar__bar relative origin-left"
        style={{
          height,
          width: `${pct}%`,
          opacity: visible ? 1 : 0,
          transition: state.active ? 'width 200ms linear, opacity 320ms ease' : 'none',
        }}
      >
        <div
          className="sx-topbar__peg absolute top-0 right-0 h-full w-24"
          style={{ opacity: visible ? 1 : 0 }}
        />
      </div>
    </div>
  );
}
TopProgress.displayName = 'TopProgress';

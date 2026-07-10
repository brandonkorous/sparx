'use client';

import * as React from 'react';
import { cn } from '../../utils/cn';
import { topProgress } from './top-progress-controller';
import { installNavigationListeners, resolveRouteModule } from './top-progress-nav';

// TopProgress — the page-top loading bar (GitHub-style). It springs in on a
// navigation, trickles toward a cap, then snaps to 100% and fades when the
// route commits. The fill REVEALS a gradient sized to the viewport, so progress
// literally moves through the identity of the current scope. Three fills, one
// principle — all token-driven (tokens.css `.sx-topbar*`), all the same sweep:
//
//   • platform (`tone="auto"`, no module) → the full module spectrum
//   • a module  (`tone="auto"`, in module) → a sweep of --color-module
//   • a TENANT SITE (`tone="brand"`)       → a sweep of the tenant's --color-primary
//
// The brand fill needs no CSS of its own: `.sx-topbar__bar` already sweeps
// `var(--color-module)`, so pointing that var at `--color-primary` reuses the
// module ramp verbatim. That is why the storefront shares this bar instead of
// forking one — a tenant site is just a scope whose identity is its brand.
//
// The bar reads route from the `route` prop (the app passes `usePathname()`),
// so this component stays Next-agnostic. It also exposes the imperative
// `topProgress` API for non-navigation work (saves, long fetches).

/** Which identity the fill wears. `auto` resolves the route's module (dashboard
 *  + marketing); `brand` pins it to the tenant's primary (a tenant storefront,
 *  where sparx's module palette means nothing to the visitor). */
export type TopProgressTone = 'auto' | 'brand';

export interface TopProgressProps {
  /** Current route key — pass `usePathname()`. When it changes, the in-flight
   *  navigation completes. Required for App Router route tracking. */
  route?: string;
  /** Identity the fill wears. Default `auto`. */
  tone?: TopProgressTone;
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
  tone = 'auto',
  height = 3,
  zIndex = 1600,
  intercept = true,
}: TopProgressProps) {
  const state = React.useSyncExternalStore(
    topProgress.subscribe,
    topProgress.getState,
    topProgress.getServerState
  );

  const brand = tone === 'brand';

  // Navigation start → run the route job, tinted to the destination module. A
  // brand bar has no module axis, so it always starts an untinted route job.
  React.useEffect(() => {
    if (!intercept) return;
    return installNavigationListeners((module) => topProgress.startRoute(brand ? null : module));
  }, [intercept, brand]);

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
  const module = brand ? null : (state.module ?? resolveRouteModule(route));
  // A brand bar drives the module ramp too — it just aims it at the tenant hue,
  // so it must never fall through to the platform spectrum.
  const inModule = brand || module != null;

  const style: React.CSSProperties = { zIndex };
  if (inModule) {
    // Point the bar's --color-module at the hue this scope should wear, since
    // the bar mounts at the app root (outside any ModuleProvider subtree).
    (style as Record<string, string>)['--color-module'] = brand
      ? 'var(--color-primary)'
      : `var(--color-module-${module})`;
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

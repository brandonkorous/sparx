'use client';

import { QueryProvider } from '@sparx/query/provider';
import { ImperativeAlertDialogProvider, ToastProvider } from '@wizeworks/silicaui-react';
import { CrashListeners } from '@/components/crash-listeners';
import { PostHogProvider } from '@/components/posthog-provider';
import { RootBoundary } from '@/components/root-boundary';
import { WriteFailureReporter } from '@/components/write-failure-reporter';
// Importing this module IS the brand configuration — it calls configureProduct()
// at module scope. It sits FIRST on purpose: everything below is a consumer, and
// the root boundary in particular renders when the app has already fallen over,
// which is the worst possible moment to discover the product's name has not been
// set yet.
//
// The SAME module is imported by components/console-shell.tsx, which needs it
// evaluated before the surface catalog. Two import sites of one side-effect
// module is correct and deliberate: ES modules evaluate once, so whichever loads
// first configures the adapter and the other is a no-op.
//
// There used to be TWO adapter modules — this one and lib/console/product.tsx —
// both calling configureProduct at module scope with different values. Whichever
// ran last won, which is how the loading mark quietly lost its breathing
// animation. There is one now.
import '@/lib/console/product';

// The console's root providers.
//
// Every one of them is the shared workbench's, mounted rather than rebuilt: they
// are infrastructure, not chrome. A crash listener that recovers a tab whose
// chunks a deploy purged, a reporter that surfaces a write which silently did
// not happen, a toast host, a confirm host — none of that is brand-shaped, and a
// second copy would be a second thing to keep in step with the surfaces that
// depend on it.
//
// What IS brand-shaped is one import away: the product adapter above.
//
// Lives in a client component rather than in the layout because the layout is a
// server component, and a `configureProduct()` call that only ever runs on the
// server would leave every client render answering "sparx".

export function ConsoleProviders({ children }: { children: React.ReactNode }) {
  return (
    // Wraps the PROVIDERS, which app/error.tsx cannot reach — it boundaries
    // their children, not them. Without this, a throw in the query client,
    // toasts or the confirm dialog falls all the way to the framework's own
    // replacement document.
    <RootBoundary>
      <QueryProvider devtools devtoolsButtonPosition="bottom-right">
        {/* Product analytics. No-ops outside production and when no key is
            baked, so wrapping the tree unconditionally is safe — and mounting it
            is what keeps the console from being the surface nobody has numbers
            for. The KEY is per-deployment configuration, not brand code: the
            Piggles pods carry a Piggles project key, and the same component
            reads it. */}
        <PostHogProvider>
          {/* Toasts + the imperative confirm mount once at the root so any pane or
            piece of chrome can announce an outcome or ask "are you sure" without
            owning UI. The async confirm replaces window.confirm everywhere a
            Base UI menu is involved — a BLOCKING confirm inside a menu-item
            click freezes the menu mid-close. */}
          <ToastProvider>
            <ImperativeAlertDialogProvider>{children}</ImperativeAlertDialogProvider>
            {/* The floor under every failed save. A mutation rejects inside a
              promise, so no error boundary can see it — without this, a write
              that silently did not happen leaves the screen showing the change
              as though it did. */}
            <WriteFailureReporter />
            {/* Recovers a tab whose chunks a deploy purged, and reports every
              other unhandled error and rejection that reaches `window`. Mounted
              at the root rather than in the shell: a chunk error can strike
              before the shell ever renders, which is precisely when nothing else
              can recover it. */}
            <CrashListeners />
          </ToastProvider>
        </PostHogProvider>
      </QueryProvider>
    </RootBoundary>
  );
}

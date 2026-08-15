'use client';

// The last boundary that can still render properly.
//
// app/error.tsx covers everything BELOW the providers, and it is the one that
// fires almost always. But the providers themselves — query client, analytics,
// toasts, the imperative confirm — sit above it in app/layout.tsx, so a throw
// inside one of those skipped it entirely and landed on app/global-error.tsx:
// a whole replacement document painted in literal hexes, because a layout that
// threw cannot be assumed to have loaded globals.css. That has happened, from a
// toast manager caught in an add-loop (see components/update-notifier.tsx).
//
// It does not have to be that bleak. By the time a PROVIDER throws, the layout's
// own JSX — <html>, <body>, the stylesheet links — has already rendered, so the
// tokens and silica classes really are there. A boundary here therefore recovers
// with the actual design system one layer before the fallback that cannot.
//
// What it deliberately does NOT do is re-render `children` without the provider
// that failed. Every provider here wraps the app precisely because the app reads
// it: `useToast()` is Base UI's `useToastManager()`, which throws when there is
// no provider above it, so a fallback that dropped one would convert a single
// crash into one per consumer. The honest recovery at this level is a reload —
// so this screen says so, and says what it costs, rather than pretending the
// workbench is still usable underneath.

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@wizeworks/silicaui-react';
import { isChunkLoadError, reloadOnceForStaleBuild } from '@sparx/app-kit';
import { reportCrash } from '../lib/analytics';
import { productName } from '../lib/product';

export class RootBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state: { failed: boolean } = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[workbench] root providers crashed', error, info.componentStack);
    // Best-effort: if PostHog's own provider is what threw, this no-ops. It
    // still earns its place for the other three.
    reportCrash(error, { boundary: 'root' });
    if (isChunkLoadError(error)) reloadOnceForStaleBuild();
  }

  override render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="bg-base-300 flex h-dvh w-full items-center justify-center p-6">
        <div className="bg-base-100 border-base-300 flex max-w-md flex-col items-center gap-4 rounded-xl border p-8 text-center">
          <AlertTriangle className="text-warning size-7" aria-hidden />
          <div>
            <h1 className="text-lg font-semibold">{productName()} needs to start again</h1>
            {/* Names the one real cost up front. Panel ARRANGEMENT is persisted
                and comes back; anything typed and not yet saved does not, and
                being told that after the fact is how people stop trusting the
                app. There is nothing to offer but a reload, so the honest thing
                is to say what it will take with it. */}
            <p className="mt-2 text-base">
              Something went wrong before the workbench finished loading. Reloading fixes it — your
              panels come back exactly as you left them, though anything you had typed and not saved
              will be gone.
            </p>
          </div>
          <Button
            color="primary"
            onClick={() => {
              window.location.reload();
            }}
          >
            Reload
          </Button>
        </div>
      </div>
    );
  }
}

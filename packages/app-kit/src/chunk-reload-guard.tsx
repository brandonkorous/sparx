'use client';

import { useEffect, useRef } from 'react';
import { isChunkLoadError, reloadOnceForStaleBuild } from './chunk-error';

// Catches the chunk-load failures a browser tab throws when it's left open
// across a deploy and then client-navigates to a route whose JS/CSS chunk the
// new build purged. Next surfaces these as window 'error' / 'unhandledrejection'
// events; the only real recovery is a full reload to fetch the current chunks.
// The render-time counterpart — the same failure thrown INSIDE React, which
// never reaches `window` — belongs to the app's error boundaries, which import
// the same detector from ./chunk-error so a broken build can't loop past the
// one shared cooldown.
//
// It also owns the only listener pair an app should need on those two events,
// so `onUnhandled` exists rather than a second component subscribing alongside:
// everything reaching `window` that is NOT a stale build is an error no boundary
// could have caught (a rejected promise, a throw inside a timer or a listener),
// and that is precisely the class most likely to go unnoticed. Reporting is the
// app's business — this package must not know what telemetry anyone uses — so it
// is handed out rather than done here.
//
// Renders nothing. Mount once near the app root, ABOVE the app's own providers:
// a chunk error can strike before a shell ever renders, which is precisely when
// nothing else can recover it.

export interface ChunkReloadGuardProps {
  /**
   * Called for an unhandled error or rejection that is NOT a stale-build chunk
   * failure. Stale-build errors are deliberately excluded: they are the routine
   * consequence of shipping, they already recover themselves, and reporting them
   * would bury real bugs under one entry per deploy per open tab.
   *
   * Read from a ref, so an inline closure is safe — but it must not do anything
   * that can throw: this runs inside a global error handler, and throwing there
   * is how one error becomes a loop.
   */
  readonly onUnhandled?: (error: unknown, kind: 'error' | 'rejection') => void;
}

export function ChunkReloadGuard({ onUnhandled }: ChunkReloadGuardProps = {}): null {
  // Held rather than depended on, so a caller passing a fresh closure each
  // render doesn't tear down and re-add the window listeners.
  const report = useRef(onUnhandled);
  report.current = onUnhandled;

  useEffect(() => {
    function onError(event: ErrorEvent): void {
      // Prefer the Error itself — it carries `name` and `cause`, which
      // `event.message` flattens away.
      handle(event.error instanceof Error ? event.error : event.message, 'error');
    }

    function onRejection(event: PromiseRejectionEvent): void {
      handle(event.reason, 'rejection');
    }

    function handle(input: unknown, kind: 'error' | 'rejection'): void {
      if (isChunkLoadError(input)) {
        reloadOnceForStaleBuild();
        return;
      }
      try {
        report.current?.(input, kind);
      } catch {
        // A reporter that throws must not re-enter this handler. Swallowing is
        // the only safe answer inside a global error listener.
      }
    }

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}

'use client';

// The window-level half of crash coverage, and the client boundary the server
// layout needs in order to hand a callback to it at all.
//
// Error boundaries see renders. This sees everything else: a rejected promise
// nobody awaited, a throw inside a `setTimeout`, a listener that blew up. None
// of those pass through React, so every boundary in this app stays green while
// they happen — and unlike a crashed pane, they leave nothing on screen for the
// operator to report either. Between this and WriteFailureReporter, the two
// classes React cannot catch are both covered.

import { ChunkReloadGuard } from '@wizeworks/app-kit';
import { reportCrash } from '../lib/analytics';

// Module scope, so the identity is stable across renders and the guard's
// listeners are never torn down and re-added.
function report(error: unknown, kind: 'error' | 'rejection'): void {
  reportCrash(error, { boundary: 'window', kind });
}

export function CrashListeners(): React.ReactElement {
  return <ChunkReloadGuard onUnhandled={report} />;
}

'use client';

// Last resort: fires only when the root layout itself throws.
//
// Everything below the layout is caught by app/error.tsx, which can use real
// components because the stylesheet is loaded by then. THIS cannot assume any of
// that — the layout is what failed, so globals.css, the theme tokens and the
// silica plugin classes may never have been applied. It therefore renders a
// complete, self-contained document with literal values inline.
//
// That is a deliberate, narrow exception to the no-inline-style and no-hex rules
// (root CLAUDE.md RULE #1), and it is the same exception sparx's own global-error
// takes for the same reason: a token cannot resolve when the stylesheet that
// declares it never loaded, and an unstyled white page is the failure this file
// exists to prevent. The values below are Piggles' own, copied from
// @piggles/brand/theme.css — if that palette changes, change them here too.
// Nothing else in this app may follow this pattern.

import { useEffect } from 'react';
import { isChunkLoadError, reloadOnceForStaleBuild } from '@sparx/app-kit';
import { reportCrash } from '@/lib/analytics';

// @piggles/brand/theme.css, light ramp. Light only, on purpose: reading the
// persisted theme needs the script in the layout that just threw.
const INK = '#202631';
const INK_SOFT = '#52454f';
const SURFACE = '#f7f8fa';
const PRIMARY = '#ff6f86';
const PRIMARY_INK = '#ffffff';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const stale = isChunkLoadError(error);

  useEffect(() => {
    console.error(error);
    // Best-effort, and honestly so: PostHog is initialised by a provider IN the
    // root layout, so when the layout is what threw there is nothing to report
    // through and this no-ops. It still earns its place — this file is also the
    // fallback for app/error.tsx itself throwing, and by then PostHog is up.
    reportCrash(error, {
      boundary: 'global',
      ...(error.digest ? { digest: error.digest } : {}),
    });
    // A release purged the chunk this tab was built against and it took the root
    // layout down with it — reset() re-runs the same dead build, so reload to
    // fetch the new one. The shared cooldown stops a broken build from looping.
    if (stale) reloadOnceForStaleBuild();
  }, [error, stale]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          background: SURFACE,
          color: INK,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ maxWidth: '460px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 600, margin: '0 0 10px' }}>
            {stale ? 'A new version of Piggles is ready' : 'Piggles could not start'}
          </h1>
          {/* 16px, not the 15 sparx uses — the body floor is a Piggles rule and
              a crash screen is the worst place to make someone squint. */}
          <p style={{ fontSize: '16px', lineHeight: 1.6, color: INK_SOFT, margin: '0 0 24px' }}>
            {stale
              ? 'This tab was open while we shipped an update. Reloading to pick it up.'
              : 'Something went wrong before your business finished loading. Try again in a moment — nothing you have saved is affected.'}
          </p>
          <button
            type="button"
            onClick={
              stale
                ? () => {
                    window.location.reload();
                  }
                : reset
            }
            style={{
              background: PRIMARY,
              color: PRIMARY_INK,
              border: 'none',
              borderRadius: '10px',
              padding: '11px 20px',
              fontSize: '16px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {stale ? 'Reload' : 'Try again'}
          </button>
          {error.digest ? (
            <p
              style={{
                fontFamily: 'monospace',
                fontSize: '14px',
                color: INK_SOFT,
                margin: '24px 0 0',
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}

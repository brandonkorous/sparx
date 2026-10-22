'use client';

// Fires only when the root layout throws, so globals.css may never have loaded.
// Inline styles and literal hex are the deliberate exception here (as in the
// console's global-error): a token cannot resolve without its stylesheet.

import { useEffect, type CSSProperties } from 'react';
import { useStaleBuildRecovery } from '@wizeworks/app-kit';

// @piggles/brand light ramp, as in piggles/apps/workbench/app/global-error.tsx.
const INK = '#202631';
const INK_SOFT = '#52454f';
const SURFACE = '#f7f8fa';
const PRIMARY = '#ff6f86';
const PRIMARY_INK = '#ffffff';

const BODY: CSSProperties = {
  margin: 0,
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 24px',
  background: SURFACE,
  color: INK,
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const BUTTON: CSSProperties = {
  background: PRIMARY,
  color: PRIMARY_INK,
  border: 'none',
  borderRadius: '10px',
  padding: '11px 20px',
  fontSize: '16px',
  fontWeight: 500,
  cursor: 'pointer',
};

function reload(): void {
  window.location.reload();
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { stale } = useStaleBuildRecovery(error);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={BODY}>
        <div style={{ maxWidth: '460px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 600, margin: '0 0 10px' }}>
            {stale ? 'A new version of Piggles is ready' : 'Piggles could not load this page'}
          </h1>
          <p style={{ fontSize: '16px', lineHeight: 1.6, color: INK_SOFT, margin: '0 0 24px' }}>
            {stale
              ? 'This page was open while we shipped an update. Reloading to pick it up.'
              : 'Something went wrong on our side. Try again in a moment. Nothing you have saved is affected.'}
          </p>
          <button type="button" onClick={stale ? reload : reset} style={BUTTON}>
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

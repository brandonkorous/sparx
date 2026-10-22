'use client';

// Root error boundary for the operator console: fires only when the root layout
// itself throws, so it renders a complete self-contained document.
//
// The inline styles and literal hexes are DELIBERATE (RULE #1's one exception,
// taken for the same reason as sparx/apps/web/app/global-error.tsx): the layout
// is what failed, so globals.css and every --color-* token may never have
// loaded, and an unstyled white page is the failure this file exists to stop.

import { useEffect, type CSSProperties } from 'react';
import { useStaleBuildRecovery } from '@wizeworks/app-kit';

const BODY: CSSProperties = {
  margin: 0,
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 24px',
  background: '#fbfbfd',
  color: '#14142b',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const BUTTON: CSSProperties = {
  background: '#e04631',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  padding: '10px 18px',
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
            {stale ? 'A new version of the console is ready' : 'The console hit an error'}
          </h1>
          <p style={{ fontSize: '16px', lineHeight: 1.6, color: '#14142b', margin: '0 0 24px' }}>
            {stale
              ? 'This tab was open while a release shipped. Reloading to pick it up.'
              : 'Something went wrong while loading the page. Try again in a moment.'}
          </p>
          <button type="button" onClick={stale ? reload : reset} style={BUTTON}>
            {stale ? 'Reload' : 'Try again'}
          </button>
          {error.digest ? (
            <p style={{ fontFamily: 'monospace', fontSize: '14px', margin: '24px 0 0' }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}

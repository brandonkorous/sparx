'use client';

// Route-segment error boundary (docs/50 §4). Catches render/runtime errors below
// the root layout so a single broken page degrades to a recover-able message
// instead of a blank screen. Theme-agnostic: it inherits the page text color so
// it reads correctly in both light and dark storefronts.

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the console / server logs. A future error tracker hooks in here.
    console.error(error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
      }}
    >
      <div
        style={{
          maxWidth: '460px',
          textAlign: 'center',
          padding: '40px',
          border: '1px solid rgba(128,128,128,0.25)',
          borderRadius: '14px',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '12px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#6366F1',
            margin: '0 0 12px',
          }}
        >
          Something went wrong
        </p>
        <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 10px', color: 'inherit' }}>
          This page didn&apos;t load
        </h1>
        <p style={{ fontSize: '15px', lineHeight: 1.6, opacity: 0.7, margin: '0 0 24px' }}>
          An unexpected error stopped this page from loading. You can try again, or head back to the
          store.
        </p>
        <div
          style={{ display: 'flex', gap: '14px', justifyContent: 'center', alignItems: 'center' }}
        >
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#6366F1',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 18px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <a href="/" style={{ color: '#6366F1', fontSize: '14px', textDecoration: 'underline' }}>
            Go to homepage
          </a>
        </div>
        {error.digest ? (
          <p
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11px',
              opacity: 0.5,
              margin: '24px 0 0',
            }}
          >
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
    </main>
  );
}

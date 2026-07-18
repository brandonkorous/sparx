'use client';

// Route-segment error boundary (docs/50 §4) for the marketing site. Catches
// render/runtime errors below the root layout so a broken page degrades to a
// recover-able message rather than a blank screen.

import { useEffect } from 'react';
import { SparkMascot } from '@/components/marketing/spark-mascot';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: '70vh',
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
          border: '1px solid rgba(128,128,128,0.22)',
          borderRadius: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <SparkMascot expression="sad" tone="light" size={104} bob={false} />
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 600, margin: '0 0 10px', color: 'inherit' }}>
          This page hit an error
        </h1>
        <p style={{ fontSize: '15px', lineHeight: 1.6, opacity: 0.7, margin: '0 0 24px' }}>
          Something unexpected happened. Try again, or head back to the homepage.
        </p>
        <div
          style={{ display: 'flex', gap: '14px', justifyContent: 'center', alignItems: 'center' }}
        >
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#e04631',
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
          <a href="/" style={{ color: '#e04631', fontSize: '14px', textDecoration: 'underline' }}>
            Back to sparx
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

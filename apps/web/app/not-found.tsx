import { SparkMascot } from '@/components/marketing/spark-mascot';

// 404 for the marketing site. The spark mascot carries the "nothing here" beat
// with an expression instead of a mono eyebrow — same brand character as the
// hero, reused as a state (see components/marketing/spark-mascot.tsx).
export default function NotFound() {
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
      <div style={{ maxWidth: '460px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <SparkMascot expression="surprised" tone="indigo" size={120} bob={false} />
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 600, margin: '0 0 10px', color: 'inherit' }}>
          This page wandered off
        </h1>
        <p style={{ fontSize: '15px', lineHeight: 1.6, opacity: 0.7, margin: '0 0 24px' }}>
          We couldn&apos;t find what you were looking for. It may have moved, or never existed.
        </p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            background: '#6366f1',
            color: '#fff',
            borderRadius: '8px',
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          Back to sparx
        </a>
      </div>
    </main>
  );
}

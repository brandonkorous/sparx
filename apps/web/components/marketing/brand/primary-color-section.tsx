import { Section, SectionHeader } from '../primitives';
import { CopyValue, Swatch } from './interactive';

const RAMP = [
  {
    name: 'Primary',
    value: '#6366F1',
    hex: '#6366F1',
    token: '--color-primary',
    note: 'Buttons, links, active states, the “x”.',
  },
  {
    name: 'Primary · dark',
    value: '#818CF8',
    hex: '#818CF8',
    token: '--color-primary',
    note: 'The very same token, resolved in dark mode.',
  },
  {
    name: 'Soft tint',
    value: 'color-mix(in oklab, #6366F1 15%, #ffffff)',
    hex: 'bg-primary bg-soft',
    note: 'Background washes and chips — a theme-aware computed mix, never a baked hex.',
  },
] as const;

export function PrimaryColorSection() {
  return (
    <Section id="color" surface="surface" padding="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
        <SectionHeader
          accent="var(--color-primary)"
          headline="sparx Indigo"
          lede="One brand color carries the platform. It is the “x” in the wordmark, the foundation module’s identity, and the default accent on every sparx surface — the spark, made into a hex."
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            gap: '20px',
            padding: 'clamp(32px, 5vw, 56px)',
            minHeight: '240px',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: '#6366F1',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: 'clamp(28px, 4vw, 40px)',
              letterSpacing: '-0.02em',
              color: '#fff',
            }}
          >
            sparx Indigo
          </span>
          <div className="mkt-cluster" style={{ gap: '10px' }}>
            <CopyValue value="#6366F1" tone="strong" />
            <CopyValue value="--color-primary" />
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                color: 'rgba(255,255,255,0.72)',
              }}
            >
              Geist 500 · the platform accent
            </span>
          </div>
        </div>

        <div className="mkt-grid-4-2-1">
          {RAMP.map((s) => (
            <Swatch key={s.name} {...s} />
          ))}
        </div>
      </div>
    </Section>
  );
}

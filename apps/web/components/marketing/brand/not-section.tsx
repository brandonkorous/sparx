import { Section, SectionHeader } from '../primitives';

const NOTS: { not: string; because: string }[] = [
  { not: 'Not corporate blue', because: 'We left that on the table deliberately.' },
  { not: 'Not startup teal', because: 'Overused, and we’re past that era.' },
  { not: 'Not “AI purple”', because: 'The 2023–24 default that means nothing anymore.' },
  { not: 'Not rounded and bubbly', because: 'We’re precise, not friendly.' },
  { not: 'Not gradient-heavy', because: 'Flat is the point.' },
  { not: 'Not dark-mode-only', because: 'Both modes are first-class.' },
];

export function NotSection() {
  return (
    <Section id="not" surface="surface" padding="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
        <SectionHeader
          accent="var(--module-ai)"
          headline="What sparx is not"
          lede="The brand is defined as much by what it refuses. sparx is the tool a senior developer wishes existed — technical enough to be trusted, simple enough for anyone to use."
        />

        <div className="mkt-grid-2-1">
          {NOTS.map((n) => (
            <div
              key={n.not}
              style={{
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-start',
                padding: '22px 0',
                borderTop: '1px solid var(--color-border-default)',
              }}
            >
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  marginTop: '2px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '22px',
                  height: '22px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--color-border-strong)',
                  color: 'var(--color-text-tertiary)',
                  fontSize: '12px',
                }}
              >
                ✕
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                    fontSize: '16px',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {n.not}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px',
                    lineHeight: '21px',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {n.because}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

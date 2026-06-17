import * as React from 'react';
import { Section, SectionHeader } from '../primitives';
import { CopyValue } from './interactive';

interface Role {
  role: string;
  specimen: React.ReactNode;
  specs: string[];
  use: string;
}

const ROLES: Role[] = [
  {
    role: 'Display',
    specimen: (
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: 'clamp(34px, 5vw, 52px)',
          letterSpacing: '-0.025em',
          lineHeight: 1.05,
          color: 'var(--color-text-primary)',
        }}
      >
        Everything, ignited.
      </span>
    ),
    specs: ['Geist', '500', '-0.025em'],
    use: 'Page titles, hero headings.',
  },
  {
    role: 'Heading',
    specimen: (
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: '24px',
          letterSpacing: '0',
          lineHeight: 1.25,
          color: 'var(--color-text-primary)',
        }}
      >
        Activate only what you need
      </span>
    ),
    specs: ['Geist', '500', '0 tracking'],
    use: 'Section headers, card titles.',
  },
  {
    role: 'Body',
    specimen: (
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 400,
          fontSize: '17px',
          lineHeight: 1.6,
          color: 'var(--color-text-secondary)',
        }}
      >
        sparx lets typography do the heavy lifting — no decorative elements, no gradients. White
        space is intentional, and every element has a reason to exist.
      </span>
    ),
    specs: ['Geist', '400', '1.6 leading'],
    use: 'Descriptive copy, supporting text.',
  },
  {
    role: 'Label',
    specimen: (
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: '11px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-text-secondary)',
        }}
      >
        Badge · metadata
      </span>
    ),
    specs: ['Geist', '500', '0.08em', 'uppercase'],
    use: 'Badges and metadata — not section kickers.',
  },
];

export function TypeSection() {
  return (
    <Section id="type" surface="page" padding="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
        <SectionHeader
          accent="var(--module-cms)"
          headline="Geist, doing the heavy lifting"
          lede="Geist is Vercel’s open-source interface typeface — geometric precision with editorial warmth. Hierarchy comes from size and spacing, never from heavy weights."
        />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {ROLES.map((r, i) => (
            <div
              key={r.role}
              className="mkt-stack-on-tablet"
              style={{
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: '24px',
                padding: '28px 0',
                borderTop: i === 0 ? 'none' : '1px solid var(--color-border-default)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  {r.role}
                </span>
                {r.specimen}
              </div>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '220px' }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {r.specs.map((s) => (
                    <span
                      key={s}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        color: 'var(--color-text-secondary)',
                        padding: '4px 9px',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    lineHeight: '20px',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  {r.use}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mkt-grid-2-1">
          <Note title="Two weights only">
            400 (regular) and 500 (medium) — never 600 or 700, which feel heavy against the clean
            sparx UI. The wordmark is the one deliberate exception: it sets in a bold display face
            so its letterforms match the monogram.
          </Note>
          <Note title="Fallback stack">
            <div className="mkt-cluster" style={{ gap: '8px' }}>
              <CopyValue value="'Geist', 'Inter', system-ui, -apple-system, sans-serif" />
              <CopyValue value="--font-mono" />
            </div>
          </Note>
        </div>
      </div>
    </Section>
  );
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '24px',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-xl)',
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: '15px',
          color: 'var(--color-text-primary)',
          margin: 0,
        }}
      >
        {title}
      </h3>
      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '14px',
          lineHeight: '22px',
          color: 'var(--color-text-secondary)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

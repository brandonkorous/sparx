import * as React from 'react';
import { Section, SectionHeader } from '../primitives';

/**
 * Logo misuse grid. Each tile renders a deliberately WRONG treatment of the
 * wordmark with a danger marker and a one-line caption — the fastest way to
 * communicate the rules from the wordmark section as "don't do this".
 *
 * The demos use a lightweight inline wordmark (not the official artwork) so the
 * violation — recolor, distort, rotate — is easy to stage.
 */

function Faux({
  xColor = 'var(--color-primary)',
  inkColor = 'var(--color-base-content)',
  style,
}: {
  xColor?: string;
  inkColor?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: "var(--font-wordmark, 'Inter', system-ui, sans-serif)",
        fontWeight: 700,
        fontSize: '34px',
        letterSpacing: '-0.03em',
        lineHeight: 1,
        color: inkColor,
        ...style,
      }}
    >
      spar<span style={{ color: xColor }}>x</span>
    </span>
  );
}

const DONTS: { caption: string; demo: React.ReactNode }[] = [
  {
    caption: 'Don’t recolor the “x”. It is always sparx Indigo.',
    demo: <Faux xColor="#10B981" />,
  },
  {
    caption:
      'Don’t let the “x” vanish into the letters. Keep it indigo — or, in one-color use, dimmed.',
    demo: <Faux xColor="var(--color-base-content)" />,
  },
  {
    caption: 'Don’t add shadows, glows, or gradients.',
    demo: <Faux style={{ filter: 'drop-shadow(0 4px 6px rgba(99,102,241,0.55))' }} />,
  },
  {
    caption: 'Don’t stretch, condense, or distort.',
    demo: <Faux style={{ transform: 'scaleX(1.7)', transformOrigin: 'center' }} />,
  },
  {
    caption: 'Don’t rotate or set on an angle.',
    demo: <Faux style={{ transform: 'rotate(-9deg)' }} />,
  },
  {
    caption: 'Don’t place on a low-contrast or clashing fill.',
    demo: <Faux inkColor="#7C7CF0" xColor="#A5A5F5" style={{ padding: '0 4px' }} />,
    // staged on the indigo-ish tile below for the clash
  },
];

export function MisuseSection() {
  return (
    <Section id="misuse" surface="page" padding="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
        <SectionHeader
          accent="var(--color-danger)"
          headline={
            <>
              What not to do{' '}
              <span
                style={{ color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)' }}
              >
                with the mark
              </span>
            </>
          }
          lede="The wordmark earns its clarity from restraint. These are the treatments that break it — each one undoes the single detail the brand is built on."
        />

        <div className="mkt-grid-3-2-1">
          {DONTS.map((d, i) => (
            <figure
              key={d.caption}
              style={{
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid var(--color-base-300)',
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                backgroundColor: 'var(--color-base-100)',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px 24px',
                  minHeight: '128px',
                  overflow: 'hidden',
                  backgroundColor: i === 5 ? '#6366F1' : 'var(--color-base-200)',
                  borderBottom: '1px solid var(--color-base-300)',
                }}
              >
                {d.demo}
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '26px',
                    height: '26px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-danger)',
                    color: '#fff',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '15px',
                    lineHeight: 1,
                  }}
                >
                  ✕
                </span>
              </div>
              <figcaption
                style={{
                  padding: '16px 20px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13.5px',
                  lineHeight: '20px',
                  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                }}
              >
                {d.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </Section>
  );
}

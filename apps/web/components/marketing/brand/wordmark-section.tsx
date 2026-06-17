import * as React from 'react';
import { Section, SectionHeader } from '../primitives';
import { CopyValue } from './interactive';
import { OfficialWordmark } from './assets';

const LADDER = [20, 28, 40, 56] as const;

const SPEC: { label: string; value: string; copy?: boolean }[] = [
  { label: 'Lettercase', value: 'lowercase — sparx', copy: false },
  { label: 'The “x”', value: '#6366F1', copy: true },
  { label: 'Tracking', value: '-0.03em', copy: true },
  { label: 'Minimum size', value: '16px tall', copy: false },
  { label: 'Source', value: 'sparx-wordmark.svg', copy: false },
];

const RULES = [
  'The wordmark is all-lowercase — “sparx”, never “Sparx”. The leading “s” is not capitalized.',
  'On color surfaces the “x” is always sparx Indigo, never neutral.',
  'Need one color? Use the black or white variant — the “x” stays distinct at 50% opacity.',
  'Never set the wordmark below 16px tall.',
  'Keep clear space equal to the height of the “x” on every side.',
  'Don’t re-letter, condense, or substitute the letterforms — use an official asset.',
];

export function WordmarkSection() {
  return (
    <Section id="wordmark" surface="surface" padding="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '56px' }}>
        <SectionHeader
          accent="var(--sparx-primary)"
          headline={
            <>
              The wordmark.{' '}
              <span style={{ color: 'var(--color-text-tertiary)' }}>The “x” always sparks</span>
            </>
          }
          lede="Lowercase sparx, with one detail doing the work: the “x” carries sparx Indigo — the instant of ignition the brand is named for. The outlined lockup is the canonical artwork; the live UI renders the same wordmark in the interface font."
        />
        <Showcase />
        <div className="mkt-grid-2-1">
          <ConstructionPanel />
          <ClearSpacePanel />
        </div>
        <OneColorVariants />
        <SizeLadder />
        <Rules />
      </div>
    </Section>
  );
}

function Showcase() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(44px, 8vw, 96px) 24px',
        backgroundColor: 'var(--color-bg-page)',
        border: '1px solid var(--color-border-default)',
        borderTop: '3px solid var(--sparx-primary)',
        borderRadius: 'var(--radius-xl)',
      }}
    >
      <OfficialWordmark style={{ width: 'min(440px, 72vw)' }} />
    </div>
  );
}

function ConstructionPanel() {
  return (
    <Panel title="Construction">
      <dl style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
        {SPEC.map((row, i) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              padding: '14px 0',
              borderTop: i === 0 ? 'none' : '1px solid var(--color-border-default)',
            }}
          >
            <dt
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {row.label}
            </dt>
            <dd style={{ margin: 0 }}>
              {row.copy ? (
                <CopyValue value={row.value} tone="strong" />
              ) : (
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                    fontSize: '14px',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {row.value}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function ClearSpacePanel() {
  return (
    <Panel title="Clear space & minimum size">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(28px, 5vw, 48px)',
          border: '1px dashed var(--color-border-strong)',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--color-bg-page)',
        }}
      >
        <OfficialWordmark style={{ width: 'min(240px, 60vw)' }} />
      </div>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '13.5px',
          lineHeight: '21px',
          color: 'var(--color-text-secondary)',
          margin: 0,
        }}
      >
        The dashed frame marks the minimum clear space — the height of the “x” on all sides. Below{' '}
        <strong style={{ color: 'var(--color-text-primary)' }}>16px</strong> tall the “x” loses its
        color contrast; switch to the monogram mark instead.
      </p>
    </Panel>
  );
}

function OneColorVariants() {
  return (
    <Panel title="One-color variants">
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '13.5px',
          lineHeight: '21px',
          color: 'var(--color-text-secondary)',
          margin: 0,
        }}
      >
        For print, photography, or any surface where the indigo can’t sit, use the one-color lockup.
        The “x” stays legible by dropping to 50% opacity instead of changing hue.
      </p>
      <div className="mkt-grid-2-1">
        <VariantTile bg="#FFFFFF" variant="black" border />
        <VariantTile bg="#0A0A0A" variant="white" />
      </div>
    </Panel>
  );
}

function VariantTile({
  bg,
  variant,
  border,
}: {
  bg: string;
  variant: 'black' | 'white';
  border?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(28px, 5vw, 44px)',
        backgroundColor: bg,
        border: border ? '1px solid var(--color-border-default)' : 'none',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <OfficialWordmark variant={variant} style={{ width: 'min(220px, 56vw)' }} />
    </div>
  );
}

function SizeLadder() {
  return (
    <Panel title="Size ladder">
      <div className="mkt-cluster" style={{ gap: '40px', rowGap: '28px', alignItems: 'flex-end' }}>
        {LADDER.map((h) => (
          <div
            key={h}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              alignItems: 'flex-start',
            }}
          >
            <OfficialWordmark style={{ height: `${h}px`, width: 'auto' }} />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--color-text-tertiary)',
              }}
            >
              {h}px tall
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Rules() {
  return (
    <ul
      style={{
        margin: 0,
        padding: 0,
        listStyle: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {RULES.map((rule) => (
        <li
          key={rule}
          style={{
            display: 'flex',
            gap: '12px',
            fontFamily: 'var(--font-sans)',
            fontSize: '15px',
            lineHeight: '24px',
            color: 'var(--color-text-secondary)',
          }}
        >
          <span aria-hidden style={{ color: 'var(--sparx-primary)', flexShrink: 0 }}>
            —
          </span>
          <span>{rule}</span>
        </li>
      ))}
    </ul>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '28px',
        backgroundColor: 'var(--color-bg-page)',
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
      {children}
    </div>
  );
}

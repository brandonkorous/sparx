import * as React from 'react';
import { Section, SectionHeader } from '../primitives';
import { Swatch } from './interactive';

const SEMANTIC = [
  { name: 'Success', value: '#10B981', hex: '#10B981', token: '--color-success', note: 'Confirmations, healthy states.' },
  { name: 'Warning', value: '#F59E0B', hex: '#F59E0B', token: '--color-warning', note: 'Caution, approaching limits. Dark ink on fill.' },
  { name: 'Danger', value: '#EF4444', hex: '#EF4444', token: '--color-danger', note: 'Errors, destructive actions.' },
] as const;

const LIGHT = [
  { name: 'Page', value: '#FAFAFA', hex: '#FAFAFA', token: '--color-bg-page', note: 'Page background.' },
  { name: 'Surface', value: '#FFFFFF', hex: '#FFFFFF', token: '--color-bg-surface', note: 'Cards and panels.' },
  { name: 'Border', value: '#E5E5E5', hex: '#E5E5E5', token: '--color-border-default', note: 'Hairlines and dividers.' },
  { name: 'Text', value: '#0A0A0A', hex: '#0A0A0A', token: '--color-text-primary', note: 'Body text.' },
  { name: 'Secondary', value: '#52525B', hex: '#52525B', token: '--color-text-secondary', note: 'Supporting text.' },
  { name: 'Tertiary', value: '#A1A1AA', hex: '#A1A1AA', token: '--color-text-tertiary', note: 'Hints, placeholders.' },
] as const;

const DARK = [
  { name: 'Page', value: '#0F0F0F', hex: '#0F0F0F', token: '--color-bg-page', note: 'Page background.' },
  { name: 'Surface', value: '#1A1A1A', hex: '#1A1A1A', token: '--color-bg-surface', note: 'Cards and panels.' },
  { name: 'Border', value: '#2A2A2A', hex: '#2A2A2A', token: '--color-border-default', note: 'Hairlines and dividers.' },
  { name: 'Text', value: '#F0F0F0', hex: '#F0F0F0', token: '--color-text-primary', note: 'Body text.' },
  { name: 'Secondary', value: '#A1A1AA', hex: '#A1A1AA', token: '--color-text-secondary', note: 'Supporting text.' },
  { name: 'Tertiary', value: '#52525B', hex: '#52525B', token: '--color-text-tertiary', note: 'Hints, placeholders.' },
] as const;

export function PaletteSection() {
  return (
    <Section id="palette" surface="surface" padding="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '56px' }}>
        <SectionHeader
          accent="var(--color-success)"
          headline="Semantic & neutral palette"
          lede="Three semantic colors mean the same thing on every surface and are never used as decoration. The neutrals are near-white and near-black, never the real thing — both light and dark are first-class."
        />

        <Group title="Semantic — reserved, never decorative">
          <div className="mkt-grid-3-2-1">
            {SEMANTIC.map((s) => (
              <Swatch key={s.name} {...s} />
            ))}
          </div>
        </Group>

        <Group title="Neutrals — light mode">
          <div className="mkt-grid-4-2-1">
            {LIGHT.map((s) => (
              <Swatch key={s.name} {...s} height={72} />
            ))}
          </div>
        </Group>

        <Group title="Neutrals — dark mode">
          <div className="mkt-grid-4-2-1">
            {DARK.map((s) => (
              <Swatch key={s.name} {...s} height={72} />
            ))}
          </div>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              lineHeight: '22px',
              color: 'var(--color-text-secondary)',
              margin: 0,
              maxWidth: '640px',
            }}
          >
            Neither pure white nor pure black — near-white and near-black backgrounds feel
            intentional in both modes, never like an inverted screenshot.
          </p>
        </Group>
      </div>
    </Section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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

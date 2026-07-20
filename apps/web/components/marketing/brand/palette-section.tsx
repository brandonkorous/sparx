import * as React from 'react';
import { Section, SectionHeader, Text } from '../primitives';
import { Swatch } from './interactive';

// Every swatch paints a LIVE `var(--color-*)` and reads its hex back from what
// the browser resolves — so these can never drift from @sparx/brand/theme.css.
const SEMANTIC = [
  {
    name: 'Success',
    value: 'var(--color-success)',
    token: '--color-success',
    note: 'Confirmations, healthy states.',
  },
  {
    name: 'Warning',
    value: 'var(--color-warning)',
    token: '--color-warning',
    note: 'Caution, approaching limits. Dark ink on fill.',
  },
  {
    name: 'Danger',
    value: 'var(--color-danger)',
    token: '--color-danger',
    note: 'Errors, destructive actions.',
  },
] as const;

// Named for the silica tokens they ARE — the retired sparx vocabulary
// ("Surface / Page / Border / Text") is gone; the human meaning lives in `note`.
const NEUTRALS = [
  { name: 'Base 100', token: '--color-base-100', note: 'Cards and panels.' },
  { name: 'Base 200', token: '--color-base-200', note: 'Page ground.' },
  { name: 'Base 300', token: '--color-base-300', note: 'Hairlines and dividers.' },
  { name: 'Base content', token: '--color-base-content', note: 'Body text.' },
] as const;

export function PaletteSection() {
  return (
    <Section id="palette" surface="surface" padding="lg">
      <div className="flex flex-col gap-14">
        <SectionHeader
          accent="var(--color-success)"
          headline="Semantic & neutral palette"
          lede="Three semantic colors mean the same thing on every surface and are never used as decoration. The neutrals are a single base ramp — near-white and near-black, never the real thing — where each token resolves to its own value in light and dark. Every tile below is painted from the live token, so what you see is exactly what ships."
        />

        <Group title="Semantic — reserved, never decorative">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SEMANTIC.map((s) => (
              <Swatch key={s.name} {...s} />
            ))}
          </div>
        </Group>

        <Group title="Neutrals — light mode">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {NEUTRALS.map((s) => (
              <Swatch key={s.name} value={`var(${s.token})`} {...s} height={72} />
            ))}
          </div>
        </Group>

        <Group title="Neutrals — dark mode">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {NEUTRALS.map((s) => (
              <Swatch key={s.name} value={`var(${s.token})`} theme="dark" {...s} height={72} />
            ))}
          </div>
          <Text size={14} className="max-w-[640px]">
            Neither pure white nor pure black — near-white and near-black backgrounds feel
            intentional in both modes, never like an inverted screenshot.
          </Text>
        </Group>
      </div>
    </Section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <Text as="h3" size={15} weight={500} tone="default">
        {title}
      </Text>
      {children}
    </div>
  );
}

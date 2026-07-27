import * as React from 'react';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import { Section, SectionHeader, Text } from '../primitives';
import { CopyValue } from './interactive';
import { OfficialWordmark } from './assets';

const LADDER = [20, 28, 40, 56] as const;

const SPEC: { label: string; value: string; copy?: boolean }[] = [
  { label: 'Lettercase', value: 'lowercase — sparx', copy: false },
  { label: 'The “x”', value: '#e04631', copy: true },
  { label: 'Tracking', value: '-0.03em', copy: true },
  { label: 'Minimum size', value: '16px tall', copy: false },
  { label: 'Source', value: 'sparx-wordmark.svg', copy: false },
];

const RULES = [
  'The wordmark is all-lowercase — “sparx”, never “Sparx”. The leading “s” is not capitalized.',
  'On color surfaces the “x” is always sparx Ember, never neutral.',
  'Need one color? Use the black or white variant — the “x” stays distinct at 50% opacity.',
  'Never set the wordmark below 16px tall.',
  'Keep clear space equal to the height of the “x” on every side.',
  'Don’t re-letter, condense, or substitute the letterforms — use an official asset.',
];

export function WordmarkSection() {
  return (
    <Section id="wordmark" surface="surface" padding="lg">
      <div className="flex flex-col gap-14">
        <SectionHeader
          accent="var(--color-primary)"
          headline={
            <>
              The wordmark. <span className="text-ink-subtle">The “x” always sparks</span>
            </>
          }
          lede="Lowercase sparx, with one detail doing the work: the “x” carries sparx Ember — the instant of ignition the brand is named for. The vector lockup is the canonical artwork, and the live UI renders the very same paths."
        />
        <Showcase />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
    <Card className="bg-primary bg-soft">
      <CardBody className="flex items-center justify-center px-6 py-[clamp(44px,8vw,96px)]">
        <OfficialWordmark className="w-[min(440px,72vw)]" />
      </CardBody>
    </Card>
  );
}

function ConstructionPanel() {
  return (
    <Panel title="Construction">
      <dl className="flex flex-col">
        {SPEC.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center justify-between gap-4 py-3.5 ${i === 0 ? '' : 'border-base-300 border-t'}`}
          >
            <Text as="dt" size={14}>
              {row.label}
            </Text>
            <dd>
              {row.copy ? (
                <CopyValue value={row.value} tone="strong" />
              ) : (
                <Text as="span" size={14} weight={500} tone="default">
                  {row.value}
                </Text>
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
      <div className="bg-base-200 border-base-content/30 flex items-center justify-center rounded-lg border border-dashed p-[clamp(28px,5vw,48px)]">
        <OfficialWordmark className="w-[min(240px,60vw)]" />
      </div>
      <Text size={13.5}>
        The dashed frame marks the minimum clear space — the height of the “x” on all sides. Below{' '}
        <strong className="text-base-content">16px</strong> tall the “x” loses its color contrast;
        switch to the mark instead.
      </Text>
    </Panel>
  );
}

function OneColorVariants() {
  return (
    <Panel title="One-color variants">
      <Text size={13.5}>
        For print, photography, or any surface where the Ember can’t sit, use the one-color lockup.
        The “x” stays legible by dropping to 50% opacity instead of changing hue.
      </Text>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <VariantTile theme="light" variant="black" />
        <VariantTile theme="dark" variant="white" />
      </div>
    </Panel>
  );
}

// Specimen tile as a data-theme island: base-100 flips to white / brand navy,
// so each one-color lockup sits on a real token surface, no hardcoded bg.
function VariantTile({ theme, variant }: { theme: 'light' | 'dark'; variant: 'black' | 'white' }) {
  return (
    <Card data-theme={theme} className="bg-base-100">
      <CardBody className="flex items-center justify-center p-[clamp(28px,5vw,44px)]">
        <OfficialWordmark variant={variant} className="w-[min(220px,56vw)]" />
      </CardBody>
    </Card>
  );
}

function SizeLadder() {
  return (
    <Panel title="Size ladder">
      <div className="flex flex-wrap items-end gap-x-10 gap-y-7">
        {LADDER.map((h) => (
          <div key={h} className="flex flex-col items-start gap-3">
            <OfficialWordmark style={{ height: `${h}px`, width: 'auto' }} />
            <Text as="span" mono size={11} tone="subtle">
              {h}px tall
            </Text>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Rules() {
  return (
    <ul className="flex list-none flex-col gap-3">
      {RULES.map((rule) => (
        <Text as="li" key={rule} size={15} className="flex gap-3">
          <span aria-hidden className="text-primary shrink-0">
            —
          </span>
          <span>{rule}</span>
        </Text>
      ))}
    </ul>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-5">
        <Text as="h3" size={15} weight={500} tone="default">
          {title}
        </Text>
        {children}
      </CardBody>
    </Card>
  );
}
